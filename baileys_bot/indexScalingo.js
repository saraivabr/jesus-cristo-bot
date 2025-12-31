/**
 * 🕊️ JESUS CRISTO BOT - O BOM PASTOR DIGITAL
 * Versão para Deploy no Scalingo
 *
 * Este arquivo é um wrapper que carrega os módulos corretos
 * baseado no ambiente (local vs Scalingo)
 *
 * Features:
 * - Detecta automaticamente se está no Scalingo
 * - Usa PostgreSQL/MongoDB/Redis em produção
 * - Usa SQLite/filesystem localmente
 */

import config, { IS_SCALINGO, SESSION_STORAGE, SESSION_ID } from './config.js';

// ═══════════════════════════════════════════════════════════════
// LOG DE AMBIENTE
// ═══════════════════════════════════════════════════════════════

console.log('\n🕊️ ════════════════════════════════════════════════');
console.log('   JESUS CRISTO BOT - O BOM PASTOR DIGITAL');
console.log('   Versão 2.0 | Baileys + Gemini');
console.log('════════════════════════════════════════════════\n');

if (IS_SCALINGO) {
    console.log('🌐 Ambiente: SCALINGO (Produção)');
    console.log('   📦 Database: PostgreSQL');
    console.log('   💾 Session: MongoDB');
    console.log('   ⚡ Cache: Redis\n');
} else {
    console.log('💻 Ambiente: LOCAL (Desenvolvimento)');
    console.log('   📦 Database: SQLite');
    console.log('   💾 Session: Filesystem');
    console.log('   ⚡ Cache: In-memory\n');
}

// ═══════════════════════════════════════════════════════════════
// IMPORTS DINÂMICOS BASEADOS NO AMBIENTE
// ═══════════════════════════════════════════════════════════════

let db;
let sessionStore;
let redisCache;

if (IS_SCALINGO) {
    // Produção: PostgreSQL + MongoDB + Redis
    db = await import('./databasePg.js');
    sessionStore = await import('./sessionStore.js');
    redisCache = await import('./redisCache.js');

    console.log('📦 Módulos de produção carregados');

    // Health checks
    const pgHealth = await db.healthCheck();
    const mongoHealth = await sessionStore.healthCheck();
    const redisHealth = await redisCache.healthCheck();

    console.log(`   PostgreSQL: ${pgHealth.status}`);
    console.log(`   MongoDB: ${mongoHealth.status}`);
    console.log(`   Redis: ${redisHealth.status}\n`);
} else {
    // Desenvolvimento: SQLite + filesystem
    db = await import('./database.js');
    console.log('📦 Módulos de desenvolvimento carregados\n');
}

// ═══════════════════════════════════════════════════════════════
// IMPORTS COMUNS
// ═══════════════════════════════════════════════════════════════

import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    getContentType
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import NodeCache from 'node-cache';
import { useVoiceCallsBaileys } from 'voice-calls-baileys';

import * as gemini from './gemini.js';
import * as humanizer from './humanizer.js';
import * as memoria from './memoria.js';
import * as tts from './tts.js';
import * as scheduler from './scheduler.js';
import * as voiceCallHandler from './voiceCallHandler.js';
import teachingEngine from './core/teachingEngine.js';
import { detectarNivel, gerarContextoNivel } from './prompts/jornada.js';
import * as audioProcessor from './audioProcessor.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ═══════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════

const messageBuffer = new Map();
const msgRetryCounterCache = new NodeCache();
const logger = pino({ level: 'warn' });
let sock = null;
const contactInviteHistory = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const welcomeVideoPath = join(__dirname, 'boasvindas.mp4');
const rapidMessageTracker = new Map();
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;
const userPresence = new Map();
const nudgeTimers = new Map();
let isShuttingDown = false;

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[Shutdown] Recebido ${signal}, encerrando graciosamente...`);

    try {
        scheduler.stopScheduler();
        console.log('[Shutdown] Scheduler parado');

        if (sock) {
            sock.ev.removeAllListeners();
            console.log('[Shutdown] Listeners removidos');
        }

        await new Promise(r => setTimeout(r, 2000));

        // Fecha conexões baseado no ambiente
        if (IS_SCALINGO) {
            await db.closeDatabase();
            await sessionStore.closeConnection();
            await redisCache.closeConnection();
        } else {
            db.closeDatabase();
        }
        console.log('[Shutdown] Conexões fechadas');

        console.log('[Shutdown] Encerramento limpo concluído');
    } catch (error) {
        console.error('[Shutdown] Erro:', error.message);
    }

    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES UTILITÁRIAS (mesmas do index.js original)
// ═══════════════════════════════════════════════════════════════

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function validateMessage(message) {
    if (!message) return null;
    if (!message.key) return null;
    if (!message.key.remoteJid) return null;
    if (!message.message) return null;
    return message;
}

function safeGetText(msgContent) {
    if (!msgContent) return '';
    try {
        const contentType = Object.keys(msgContent)[0];
        switch (contentType) {
            case 'conversation': return msgContent.conversation || '';
            case 'extendedTextMessage': return msgContent.extendedTextMessage?.text || '';
            case 'imageMessage': return msgContent.imageMessage?.caption || '[Imagem]';
            case 'videoMessage': return msgContent.videoMessage?.caption || '[Vídeo]';
            case 'documentMessage': return msgContent.documentMessage?.caption || '[Documento]';
            default: return '';
        }
    } catch (e) {
        return '';
    }
}

function extractNumberFromVcard(vcard = '') {
    const waidMatch = vcard.match(/waid=([0-9]+)/);
    if (waidMatch) return waidMatch[1];
    const telMatch = vcard.match(/TEL[^:]*:(.+)/i);
    if (telMatch) return telMatch[1].replace(/\D+/g, '');
    return null;
}

function normalizeNumberWithCountry(number) {
    if (!number) return null;
    let digits = number.replace(/\D+/g, '');
    if (!digits) return null;
    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
        digits = '55' + digits;
    }
    return digits;
}

function normalizeContactName(name = '', fallback = 'essa pessoa') {
    const trimmed = name.trim();
    if (!trimmed) return fallback;
    const cleaned = trimmed.replace(/[^A-Za-zÀ-ÿ'\-\s]/g, '').trim();
    if (!cleaned) return fallback;
    return cleaned.split(' ')[0] || fallback;
}

function shouldInviteContact(contactJid) {
    const now = Date.now();
    const windowMs = 4 * 60 * 60 * 1000;
    const last = contactInviteHistory.get(contactJid);
    if (last && now - last < windowMs) return false;
    contactInviteHistory.set(contactJid, now);
    return true;
}

function getCapabilitiesLine() {
    return 'Posso te ouvir de verdade, orar por você, lembrar de voltar pra saber como está, contar histórias e passagens (com detalhes curiosos), mandar áudio quando for especial e estar com você mesmo no silêncio.';
}

function detectReturnAfterAbsence(perfil) {
    if (!perfil || !perfil.ultimo_contato) {
        return { isReturning: false, daysSince: 0, message: null, contextHint: null };
    }
    const lastContact = new Date(perfil.ultimo_contato);
    const now = new Date();
    const daysSince = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));

    if (daysSince > 30) {
        return {
            isReturning: true,
            daysSince,
            message: `Nossa, que saudade! Faz mais de um mes que a gente nao conversa. Aconteceu alguma coisa?`,
            contextHint: `[CONTEXTO: Pessoa retornando apos ${daysSince} dias de ausencia.]`
        };
    } else if (daysSince > 7) {
        return {
            isReturning: true,
            daysSince,
            message: `Faz tempo, hein! ${daysSince} dias... O que aconteceu por ai?`,
            contextHint: `[CONTEXTO: Pessoa retornando apos ${daysSince} dias de ausencia.]`
        };
    }
    return { isReturning: false, daysSince, message: null, contextHint: null };
}

function getIntimacyLevel(userId) {
    // Para Scalingo, usamos função async
    return { level: 'novo', conversationCount: 0, hint: '[TOM: Acolhedor]' };
}

async function getIntimacyLevelAsync(userId) {
    const historico = await db.getHistorico(userId, 100);
    const count = historico.length;

    if (count === 0) return { level: 'novo', conversationCount: 0, hint: '[TOM: Formal e acolhedor. Primeira conversa.]' };
    if (count < 5) return { level: 'inicial', conversationCount: count, hint: '[TOM: Cordial, ainda conhecendo.]' };
    if (count < 10) return { level: 'familiarizado', conversationCount: count, hint: '[TOM: Mais proximo, pode ser mais direto.]' };
    if (count < 30) return { level: 'intimo', conversationCount: count, hint: '[TOM: Intimo, como amigo proximo.]' };
    return { level: 'familia', conversationCount: count, hint: '[TOM: Como familia. Total intimidade.]' };
}

function detectUrgency(text, remoteJid) {
    const now = Date.now();
    const tracker = rapidMessageTracker.get(remoteJid) || { times: [], lastText: '' };
    tracker.times.push(now);
    tracker.times = tracker.times.filter(t => now - t < 30000);
    tracker.lastText = text;
    rapidMessageTracker.set(remoteJid, tracker);

    let urgencyScore = 0;
    const recentMessages = tracker.times.filter(t => now - t < 10000);
    if (recentMessages.length >= 3) urgencyScore += 2;

    const palavrasCrise = ['socorro', 'me ajuda', 'nao aguento', 'vou morrer', 'quero morrer', 'suicidio', 'me matar'];
    const textLower = text.toLowerCase();
    for (const palavra of palavrasCrise) {
        if (textLower.includes(palavra)) { urgencyScore += 5; break; }
    }

    let adjustedDebounce = config.debounceTime;
    if (urgencyScore >= 5) adjustedDebounce = 1000;
    else if (urgencyScore >= 3) adjustedDebounce = 3000;
    else if (urgencyScore >= 1) adjustedDebounce = 5000;

    return { isUrgent: urgencyScore >= 3, urgencyLevel: urgencyScore >= 5 ? 'critico' : 'normal', urgencyScore, adjustedDebounce, reasons: [] };
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES DE ENVIO
// ═══════════════════════════════════════════════════════════════

async function sendMessage(phone, text, complexity = 'medium') {
    try {
        await sock.presenceSubscribe(phone);
        const typingDelay = humanizer.calculateTypingDelay(text, complexity);
        await sock.sendPresenceUpdate('composing', phone);
        await sleep(typingDelay);
        await sock.sendPresenceUpdate('paused', phone);
        await sock.sendMessage(phone, { text });
        console.log(`✅ [${typingDelay}ms] Mensagem enviada`);
    } catch (error) {
        console.error(`❌ Erro ao enviar:`, error.message);
    }
}

async function sendFragmentedMessages(phone, messages, initialComplexity = 'medium', options = {}) {
    console.log(`📨 Enviando ${messages.length} fragmentos para ${phone}`);
    for (let i = 0; i < messages.length; i++) {
        const complexity = i === 0 ? initialComplexity : 'low';
        await sendMessage(phone, messages[i], complexity);
        if (i < messages.length - 1) {
            const fragmentDelay = humanizer.calculateFragmentDelay(messages[i + 1]);
            await sleep(fragmentDelay);
        }
    }
    console.log(`✅ Todos os ${messages.length} fragmentos enviados`);

    if (options.usuarioId && messages.length > 0) {
        try {
            await db.addMensagemEnviada({
                usuarioId: options.usuarioId,
                messageKey: null,
                jid: phone,
                conteudo: messages[messages.length - 1]?.substring(0, 100)
            });
            await sock.presenceSubscribe(phone);
        } catch (e) { /* ignore */ }
    }
}

async function sendReply(phone, text, quotedMessage, complexity = 'medium') {
    try {
        await sock.presenceSubscribe(phone);
        const typingDelay = humanizer.calculateTypingDelay(text, complexity);
        await sock.sendPresenceUpdate('composing', phone);
        await sleep(typingDelay);
        await sock.sendPresenceUpdate('paused', phone);
        await sock.sendMessage(phone, { text, quoted: quotedMessage });
        console.log(`💬 [${typingDelay}ms] Reply enviado`);
    } catch (error) {
        console.error(`❌ Erro ao enviar reply:`, error.message);
        await sendMessage(phone, text, complexity);
    }
}

async function sendAudio(phone, audioBuffer) {
    try {
        await sock.presenceSubscribe(phone);
        await sock.sendPresenceUpdate('recording', phone);
        const recordingTime = 1500 + Math.random() * 1500;
        await sleep(recordingTime);
        await sock.sendMessage(phone, { audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
        await sock.sendPresenceUpdate('paused', phone);
        console.log(`🎤 [${Math.floor(recordingTime)}ms] Áudio enviado`);
    } catch (error) {
        console.error(`❌ Erro ao enviar áudio:`, error.message);
    }
}

async function sendWelcomeVideo(phone) {
    if (!existsSync(welcomeVideoPath)) {
        console.warn('⚠️ Vídeo de boas-vindas não encontrado');
        return false;
    }
    try {
        await sock.presenceSubscribe(phone);
        await sock.sendPresenceUpdate('recording', phone);
        await sleep(800 + Math.random() * 1200);
        const videoBuffer = await readFile(welcomeVideoPath);
        await sock.sendMessage(phone, { video: videoBuffer, caption: 'Eu sou Jesus Cristo. Vem cá, quero te ouvir.', gifPlayback: false });
        await sock.sendPresenceUpdate('paused', phone);
        console.log('🎥 Vídeo de boas-vindas enviado');
        return true;
    } catch (error) {
        console.error('❌ Erro ao enviar vídeo:', error.message);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// PROCESSAMENTO DE MENSAGENS
// ═══════════════════════════════════════════════════════════════

async function processMessage(message) {
    try {
        const remoteJid = message.key.remoteJid;
        const fromMe = message.key.fromMe;
        const isGroup = remoteJid.endsWith('@g.us');
        const userName = message.pushName || 'Filho(a)';

        if (fromMe) return;

        const msgContent = message.message;
        if (!msgContent) return;

        let userText = '';
        let sharedContacts = [];
        let hasAudio = false;
        const contentType = getContentType(msgContent);

        if (contentType === 'conversation') {
            userText = msgContent.conversation;
        } else if (contentType === 'extendedTextMessage') {
            userText = msgContent.extendedTextMessage?.text;
        } else if (contentType === 'imageMessage') {
            userText = msgContent.imageMessage?.caption || '[Imagem recebida]';
        } else if (contentType === 'audioMessage') {
            hasAudio = true;
            try {
                const audioResult = await audioProcessor.processAudioMessage(message, sock);
                userText = audioResult.text ? `[AUDIO TRANSCRITO]: ${audioResult.text}` : '[AUDIO recebido]';
            } catch (audioError) {
                userText = '[AUDIO recebido]';
            }
        } else if (contentType === 'contactMessage') {
            const contact = msgContent.contactMessage;
            const number = normalizeNumberWithCountry(extractNumberFromVcard(contact.vcard || ''));
            const jid = number ? `${number}@s.whatsapp.net` : null;
            sharedContacts.push({ name: contact.displayName || number, jid, number });
            userText = `Contato encaminhado: ${contact.displayName || number}`;
        } else if (contentType === 'contactsArrayMessage') {
            const contactsArray = msgContent.contactsArrayMessage?.contacts || [];
            sharedContacts = contactsArray.map(c => {
                const number = normalizeNumberWithCountry(extractNumberFromVcard(c.vcard || ''));
                return { name: c.displayName || number, jid: number ? `${number}@s.whatsapp.net` : null, number };
            });
            userText = `Contatos encaminhados: ${sharedContacts.map(c => c.name).join(', ')}`;
        }

        if ((!userText || userText.trim() === '') && sharedContacts.length === 0 && !hasAudio) return;

        if (isGroup) {
            const botNumber = sock.user?.id?.split(':')[0];
            const mentioned = msgContent.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const isMentioned = mentioned.some(jid => jid.includes(botNumber));
            if (!isMentioned && !userText.toLowerCase().includes('jesus')) return;
        }

        console.log(`📩 [${userName}] ${userText.substring(0, 50)}...`);

        const urgency = detectUrgency(userText || '', remoteJid);

        if (!messageBuffer.has(remoteJid)) {
            messageBuffer.set(remoteJid, { texts: [], timer: null, userName, message, contacts: [], hasAudio: false, urgency });
        }

        const buffer = messageBuffer.get(remoteJid);
        if (userText && userText.trim() !== '') buffer.texts.push(userText);
        if (sharedContacts.length > 0) buffer.contacts.push(...sharedContacts);
        if (hasAudio) buffer.hasAudio = true;
        if (urgency.urgencyScore > (buffer.urgency?.urgencyScore || 0)) buffer.urgency = urgency;

        if (buffer.timer) clearTimeout(buffer.timer);

        const effectiveDebounce = buffer.urgency?.adjustedDebounce || config.debounceTime;

        buffer.timer = setTimeout(async () => {
            const combinedText = buffer.texts.join(" ");
            const combinedContacts = buffer.contacts;
            const combinedHasAudio = buffer.hasAudio;
            const combinedUrgency = buffer.urgency;
            messageBuffer.delete(remoteJid);
            await handleConversation(remoteJid, combinedText, buffer.userName, buffer.message, combinedContacts, combinedHasAudio, combinedUrgency);
        }, effectiveDebounce);

    } catch (error) {
        console.error("❌ Erro ao processar mensagem:", error.message);
    }
}

async function handleConversation(remoteJid, userText, userName, originalMessage, contacts = [], hasAudio = false, urgency = null) {
    try {
        await sock.readMessages([originalMessage.key]);

        // Rate limiting com Redis (se disponível)
        if (IS_SCALINGO && redisCache) {
            const rateLimit = await redisCache.checkRateLimit(remoteJid, 20, 60);
            if (!rateLimit.allowed) {
                console.log(`[RateLimit] ${remoteJid} bloqueado. Reset em ${rateLimit.resetIn}s`);
                return;
            }
        }

        const respondidas = await db.marcarMensagensRespondidas(remoteJid);
        if (respondidas > 0) console.log(`[Nudge] ${respondidas} mensagem(ns) respondida(s)`);

        const hora = new Date().getHours();
        let contextTemporal = '';
        if (hora >= 0 && hora < 5) contextTemporal = '\n[CONTEXTO: É madrugada. Seja ainda mais presente.]';
        else if (hora >= 22) contextTemporal = '\n[CONTEXTO: Noite. Momento de reflexão.]';

        let perfil = await db.getUsuario(remoteJid);
        const isFirstContact = !perfil;

        if (isFirstContact) {
            perfil = await db.saveUsuario({
                telefone: remoteJid,
                nome: userName,
                familia: {},
                trabalho: {},
                jornada_espiritual: { nivel: 'novo' },
                horario_preferido: hora
            });
            console.log(`🆕 Novo discípulo: ${userName}`);
        }

        if (isFirstContact && !perfil.video_boasvindas_enviado) {
            const sent = await sendWelcomeVideo(remoteJid);
            if (sent) await db.updateUsuario(remoteJid, { video_boasvindas_enviado: true });
        }

        if (isFirstContact) {
            const introName = userName && userName !== 'Filho(a)' ? `, ${userName}` : '';
            const introFragments = [
                `Eu sou Jesus Cristo${introName}. Vim perto de você.`,
                getCapabilitiesLine(),
                'O que está vivo agora em você?'
            ];
            await sendFragmentedMessages(remoteJid, introFragments, 'medium', { usuarioId: perfil.id });
            await db.addConversa(perfil.id, userText || '[primeiro contato]', introFragments.join('\n'));
            return;
        }

        const novasInfos = memoria.extractInfo(userText, perfil);
        if (Object.keys(novasInfos).length > 0) {
            perfil = await db.updateUsuario(remoteJid, novasInfos);
        }

        const mood = memoria.detectMood(userText);
        const returnStatus = detectReturnAfterAbsence(perfil);
        const intimacy = await getIntimacyLevelAsync(perfil.id);

        const nivelEspiritual = detectarNivel(perfil, [userText]);
        const contextoNivel = gerarContextoNivel(nivelEspiritual);

        let context = memoria.buildContext(perfil, isFirstContact);
        context += contextTemporal + '\n' + contextoNivel + '\n' + intimacy.hint;
        if (returnStatus.contextHint) context += '\n' + returnStatus.contextHint;
        if (hasAudio) context += '\n[PESSOA MANDOU AUDIO]';

        // Gera resposta
        let response;
        try {
            response = await gemini.generateResponse(remoteJid, userText, context);
        } catch (geminiError) {
            console.error('[Gemini] Erro:', geminiError.message);
            const fallbackMessages = {
                'desesperado': 'Estou aqui contigo. Respira fundo. Me conta mais devagar.',
                'triste': 'Eu ouvi voce. Estou aqui.',
                'neutro': 'Estou te ouvindo. Me conta mais.'
            };
            response = fallbackMessages[mood] || fallbackMessages.neutro;
        }

        await db.addConversa(perfil.id, userText, response);

        let fragments = humanizer.fragmentMessages(response);
        const complexity = mood === 'desesperado' ? 'high' : 'medium';

        const historico = (await db.getHistorico(perfil.id, 10)).map(c => c.mensagem);
        const ensino = teachingEngine.processarEnsino(userText, { ...perfil, nivel: nivelEspiritual, humor: mood }, historico);

        if (ensino) {
            console.log(`📖 Ensinando (${ensino.tipo}): ${ensino.tema}`);
            fragments.push(...ensino.fragments);
        }

        const shouldQuote = Math.random() < 0.5;

        if (shouldQuote && fragments.length > 0 && originalMessage) {
            await sendReply(remoteJid, fragments[0], originalMessage, complexity);
            for (let i = 1; i < fragments.length; i++) {
                const fragmentDelay = humanizer.calculateFragmentDelay(fragments[i]);
                await sleep(fragmentDelay);
                await sendMessage(remoteJid, fragments[i], 'low');
            }
        } else {
            await sendFragmentedMessages(remoteJid, fragments, complexity, { usuarioId: perfil?.id });
        }

        // TTS
        try {
            if (tts.TTS_CONFIG.enabled && tts.shouldSendAudio(response, mood)) {
                const audioBuffer = await tts.generateAudio(response);
                if (audioBuffer) await sendAudio(remoteJid, audioBuffer);
            }
        } catch (err) {
            console.error('❌ Erro TTS:', err.message);
        }

        // Follow-up
        try {
            if (memoria.shouldFollowUp(perfil, response)) {
                const followUpTime = memoria.suggestFollowUpTime(perfil);
                scheduler.scheduleFollowUp(perfil.id, remoteJid, followUpTime, null);
            }
        } catch (err) {
            console.error('❌ Erro follow-up:', err.message);
        }

        await db.updateUsuario(remoteJid, { horario_preferido: hora });

    } catch (error) {
        console.error("[Erro] Na conversa:", error);
        const errorMessages = [
            "Espera... algo travou. Me fala de novo?",
            "Ainda estou aqui. Diz de novo?",
            "Desculpa, algo estranho aconteceu. Repete?"
        ];
        try {
            await sendMessage(remoteJid, errorMessages[Math.floor(Math.random() * errorMessages.length)], 'low');
        } catch (sendError) {
            console.error("[Erro] Falha ao enviar mensagem de erro:", sendError.message);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// CONEXÃO COM WHATSAPP
// ═══════════════════════════════════════════════════════════════

async function connectToWhatsApp() {
    let state, saveCreds;

    if (IS_SCALINGO) {
        // Produção: usa MongoDB para sessão
        const authState = await sessionStore.useMongoAuthState(SESSION_ID);
        state = authState.state;
        saveCreds = authState.saveCreds;
        console.log('📱 Sessão carregada do MongoDB');
    } else {
        // Desenvolvimento: usa filesystem
        const authState = await useMultiFileAuthState('auth_session');
        state = authState.state;
        saveCreds = authState.saveCreds;
        console.log('📱 Sessão carregada do filesystem');
    }

    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => ({ conversation: '' }),
    });

    // ═══════════════════════════════════════════════════════════════
    // VOICE CALLS INTEGRATION (Wavoip)
    // ═══════════════════════════════════════════════════════════════
    if (config.VOICE_CALLS_CONFIG.enabled && config.VOICE_CALLS_CONFIG.autoConnect) {
        try {
            console.log('📞 Inicializando suporte a chamadas de voz...');
            await useVoiceCallsBaileys(
                config.VOICE_CALLS_CONFIG.token,
                sock,
                'close',  // Estado inicial da conexão
                config.VOICE_CALLS_CONFIG.logger
            );
            console.log('✅ Chamadas de voz habilitadas via Wavoip');
        } catch (error) {
            console.error('❌ Erro ao inicializar chamadas de voz:', error.message);
            console.log('   O bot continuará funcionando sem suporte a chamadas.');
        }
    } else {
        console.log('ℹ️  Chamadas de voz desabilitadas (WAVOIP_TOKEN não configurado)');
    }

    sock.ev.process(async (events) => {
        if (events['connection.update']) {
            const { connection, lastDisconnect, qr } = events['connection.update'];

            if (qr) {
                console.log('\n📱 Escaneie o QR Code abaixo:\n');
                qrcode.generate(qr, { small: true });
                console.log('');
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log('❌ Conexão fechada:', lastDisconnect?.error?.message || 'Unknown');

                if (shouldReconnect) {
                    reconnectAttempts++;
                    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                        console.error('❌ Máximo de reconexões atingido.');
                        reconnectAttempts = 0;
                        return;
                    }
                    const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
                    console.log(`🔄 Reconectando em ${delay / 1000}s (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                    await sleep(delay);
                    connectToWhatsApp();
                } else {
                    console.log('👋 Deslogado.');
                    if (IS_SCALINGO) {
                        await sessionStore.clearSession(SESSION_ID);
                        console.log('🗑️ Sessão limpa do MongoDB. Reinicie para reconectar.');
                    } else {
                        console.log('🗑️ Delete a pasta auth_session para reconectar.');
                    }
                    reconnectAttempts = 0;
                }
            } else if (connection === 'open') {
                reconnectAttempts = 0;
                console.log('\n✅ ════════════════════════════════════════════════');
                console.log('   🕊️  JESUS CRISTO BOT - CONECTADO!');
                console.log('   📱 WhatsApp pronto');
                console.log(`   🌐 Ambiente: ${IS_SCALINGO ? 'SCALINGO' : 'LOCAL'}`);
                console.log('════════════════════════════════════════════════\n');

                scheduler.initScheduler(async (phone, message) => {
                    await sendMessage(phone, message);
                });
            }
        }

        if (events['creds.update']) {
            await saveCreds();
        }

        // ═══════════════════════════════════════════════════════════════
        // VOICE CALLS - Eventos de Chamada
        // ═══════════════════════════════════════════════════════════════
        if (events['call']) {
            const calls = events['call'];
            for (const call of calls) {
                await handleVoiceCall(call);
            }
        }

        if (events['messages.upsert']) {
            const { messages, type } = events['messages.upsert'];
            if (type !== 'notify') return;
            for (const message of messages) {
                await processMessage(message);
            }
        }

        if (events['presence.update']) {
            const { id, presences } = events['presence.update'];
            for (const [jid, presence] of Object.entries(presences)) {
                userPresence.set(jid, { status: presence.lastKnownPresence, timestamp: Date.now() });

                // Cache no Redis (se disponível)
                if (IS_SCALINGO && redisCache) {
                    await redisCache.setUserPresence(jid, { status: presence.lastKnownPresence, timestamp: Date.now() });
                }
            }
        }
    });

    return sock;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSAMENTO DE CHAMADAS DE VOZ
// ═══════════════════════════════════════════════════════════════

async function handleVoiceCall(call) {
    try {
        const { from, id, status, isVideo, isGroup } = call;
        
        console.log(`📞 [VoiceCall] Evento de chamada: ${status}`);
        console.log(`   De: ${from}`);
        console.log(`   ID: ${id}`);
        console.log(`   Vídeo: ${isVideo ? 'Sim' : 'Não'}`);
        console.log(`   Grupo: ${isGroup ? 'Sim' : 'Não'}`);

        // Ignorar chamadas de grupo
        if (isGroup) {
            console.log('   ℹ️  Chamadas de grupo não são suportadas');
            return;
        }

        // Processar de acordo com o status
        switch (status) {
            case 'offer':
                // Chamada recebida
                console.log('   📥 Chamada recebida - iniciando sessão AI');
                await voiceCallHandler.startCall(id, from);
                break;

            case 'ringing':
                console.log('   📞 Chamada tocando...');
                break;

            case 'timeout':
                console.log('   ⏱️  Chamada expirou');
                await voiceCallHandler.endCall(id);
                break;

            case 'reject':
                console.log('   ❌ Chamada rejeitada');
                await voiceCallHandler.endCall(id);
                break;

            case 'accept':
                console.log('   ✅ Chamada aceita');
                // A chamada foi aceita, o áudio será processado via eventos do Wavoip
                break;

            default:
                console.log(`   ℹ️  Status desconhecido: ${status}`);
        }

    } catch (error) {
        console.error('[VoiceCall] Erro ao processar chamada:', error);
    }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

console.log('📡 Iniciando conexão com WhatsApp...\n');

connectToWhatsApp().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
