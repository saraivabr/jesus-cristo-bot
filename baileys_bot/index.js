/**
 * 🕊️ JESUS CRISTO BOT - O BOM PASTOR DIGITAL
 * WhatsApp Bot com Baileys + Google Gemini
 *
 * Features:
 * - Memória persistente (SQLite)
 * - Fragmentação humanizada de mensagens
 * - Follow-up proativo personalizado
 * - TTS para momentos especiais
 * - Responde em grupos quando mencionado
 */

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

// Módulos internos
import config from './config.js';
import * as db from './database.js';
import * as gemini from './gemini.js';
import * as humanizer from './humanizer.js';
import * as memoria from './memoria.js';
import * as tts from './tts.js';
import * as scheduler from './scheduler.js';
import teachingEngine from './core/teachingEngine.js';
import { detectarNivel, gerarContextoNivel } from './prompts/jornada.js';

// ═══════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════

const messageBuffer = new Map(); // Buffer para debounce
const msgRetryCounterCache = new NodeCache(); // Cache para retry de mensagens
const logger = pino({ level: 'silent' });
let sock = null; // Socket do WhatsApp
const contactInviteHistory = new Map(); // Controle anti-spam de convites encaminhados

function extractNumberFromVcard(vcard = '') {
    const waidMatch = vcard.match(/waid=([0-9]+)/);
    if (waidMatch) return waidMatch[1];
    const telMatch = vcard.match(/TEL[^:]*:(.+)/i);
    if (telMatch) return telMatch[1].replace(/\\D+/g, '');
    return null;
}

function normalizeContactName(name = '', fallback = 'essa pessoa') {
    const trimmed = name.trim();
    if (!trimmed) return fallback;
    const cleaned = trimmed.replace(/[^A-Za-zÀ-ÿ'\\-\\s]/g, '').trim();
    if (!cleaned) return fallback;
    const firstName = cleaned.split(' ')[0];
    return firstName || fallback;
}

function shouldInviteContact(contactJid) {
    const now = Date.now();
    const windowMs = 4 * 60 * 60 * 1000; // 4h entre convites para o mesmo contato
    const last = contactInviteHistory.get(contactJid);
    if (last && now - last < windowMs) {
        return false;
    }
    contactInviteHistory.set(contactJid, now);
    return true;
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES DE ENVIO
// ═══════════════════════════════════════════════════════════════

/**
 * Envia mensagem com presença de "digitando" humanizada
 */
async function sendMessage(phone, text, complexity = 'medium') {
    try {
        // Subscreve à presença (mais realista)
        await sock.presenceSubscribe(phone);

        // Calcula tempo de digitação com complexidade
        const typingDelay = humanizer.calculateTypingDelay(text, complexity);

        // Envia presença "digitando"
        await sock.sendPresenceUpdate('composing', phone);

        // Aguarda tempo de digitação (simula pessoa digitando)
        await sleep(typingDelay);

        // Para de "digitar"
        await sock.sendPresenceUpdate('paused', phone);

        // Envia mensagem
        await sock.sendMessage(phone, { text });

        console.log(`✅ [${typingDelay}ms] Mensagem enviada`);
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem:`, error.message);
    }
}

/**
 * Envia mensagens fragmentadas com delays humanizados
 */
async function sendFragmentedMessages(phone, messages, initialComplexity = 'medium') {
    console.log(`📨 Enviando ${messages.length} fragmentos para ${phone}`);

    for (let i = 0; i < messages.length; i++) {
        const complexity = i === 0 ? initialComplexity : 'low';
        await sendMessage(phone, messages[i], complexity);

        if (i < messages.length - 1) {
            const fragmentDelay = humanizer.calculateFragmentDelay(messages[i + 1]);
            console.log(`   ⏳ Aguardando ${fragmentDelay}ms antes do próximo fragmento`);
            await sleep(fragmentDelay);
        }
    }

    console.log(`✅ Todos os ${messages.length} fragmentos enviados`);
}

/**
 * Envia mensagem como REPLY (citando a mensagem original)
 */
async function sendReply(phone, text, quotedMessage, complexity = 'medium') {
    try {
        await sock.presenceSubscribe(phone);
        const typingDelay = humanizer.calculateTypingDelay(text, complexity);
        await sock.sendPresenceUpdate('composing', phone);
        await sleep(typingDelay);
        await sock.sendPresenceUpdate('paused', phone);

        await sock.sendMessage(phone, {
            text,
            quoted: quotedMessage
        });

        console.log(`💬 [${typingDelay}ms] Reply enviado`);
    } catch (error) {
        console.error(`❌ Erro ao enviar reply:`, error.message);
        // Fallback para mensagem normal
        await sendMessage(phone, text, complexity);
    }
}

/**
 * Envia áudio com simulação de gravação
 */
async function sendAudio(phone, audioBuffer) {
    try {
        // Subscreve à presença
        await sock.presenceSubscribe(phone);

        // Mostra "gravando" (mais realista)
        await sock.sendPresenceUpdate('recording', phone);

        // Simula tempo de gravação proporcional ao tamanho
        const recordingTime = 1500 + Math.random() * 1500; // 1.5-3s
        await sleep(recordingTime);

        await sock.sendMessage(phone, {
            audio: audioBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        });

        // Para de "gravar"
        await sock.sendPresenceUpdate('paused', phone);

        console.log(`🎤 [${Math.floor(recordingTime)}ms] Áudio enviado`);
    } catch (error) {
        console.error(`❌ Erro ao enviar áudio:`, error.message);
    }
}

/**
 * Convida contatos encaminhados pela pessoa para conversar com Jesus
 */
async function inviteContacts(contacts, referrerName) {
    const notes = [];
    const refName = normalizeContactName(referrerName, 'um amigo');

    for (const contact of contacts) {
        const contactName = normalizeContactName(contact.name);

        if (!contact.jid) {
            notes.push(`Não consegui chamar ${contactName} (contato sem número).`);
            continue;
        }

        if (!shouldInviteContact(contact.jid)) {
            notes.push(`Já falei com ${contactName} há pouco. Vou esperar antes de chamar de novo.`);
            continue;
        }

        const invitePrompt = `${refName} pediu que eu falasse com você. Podemos conversar agora?`;

        try {
            const contactResponse = await gemini.generateResponse(contact.jid, invitePrompt, 'primeiro contato encaminhado por amigo');
            await sendMessage(contact.jid, contactResponse, 'medium');
            notes.push(`Chamei ${contactName}. Vou falar com ela agora.`);
        } catch (err) {
            console.error(`❌ Erro ao chamar contato ${contact.jid}:`, err.message);
            notes.push(`Tentei chamar ${contactName}, mas algo travou.`);
        }
    }

    return notes;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSAMENTO DE MENSAGENS
// ═══════════════════════════════════════════════════════════════

/**
 * Processa mensagem recebida
 */
async function processMessage(message) {
    try {
        const remoteJid = message.key.remoteJid;
        const fromMe = message.key.fromMe;
        const isGroup = remoteJid.endsWith('@g.us');
        const userName = message.pushName || 'Filho(a)';

        // Ignora mensagens próprias
        if (fromMe) return;

        // Extrai texto da mensagem
        const msgContent = message.message;
        if (!msgContent) return;

        let userText = '';
        let sharedContacts = [];
        const contentType = getContentType(msgContent);

        if (contentType === 'conversation') {
            userText = msgContent.conversation;
        } else if (contentType === 'extendedTextMessage') {
            userText = msgContent.extendedTextMessage?.text;
        } else if (contentType === 'imageMessage') {
            userText = msgContent.imageMessage?.caption || '[Imagem recebida]';
        } else if (contentType === 'contactMessage') {
            const contact = msgContent.contactMessage;
            const number = extractNumberFromVcard(contact.vcard || '');
            const jid = number ? `${number}@s.whatsapp.net` : null;
            sharedContacts.push({
                name: contact.displayName || number || 'essa pessoa',
                jid,
                number
            });
            userText = `Contato encaminhado: ${contact.displayName || number || 'sem nome'}`;
        } else if (contentType === 'contactsArrayMessage') {
            const contactsArray = msgContent.contactsArrayMessage?.contacts || [];
            sharedContacts = contactsArray.map(c => {
                const number = extractNumberFromVcard(c.vcard || '');
                const jid = number ? `${number}@s.whatsapp.net` : null;
                return {
                    name: c.displayName || number || 'essa pessoa',
                    jid,
                    number
                };
            });
            const names = sharedContacts.map(c => c.name).join(', ');
            userText = `Contatos encaminhados: ${names || 'sem nome'}`;
        }

        if ((!userText || userText.trim() === '') && sharedContacts.length === 0) return;

        // Em grupos, só responde se mencionado
        if (isGroup) {
            const botNumber = sock.user?.id?.split(':')[0];
            const mentioned = msgContent.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const isMentioned = mentioned.some(jid => jid.includes(botNumber));

            if (!isMentioned && !userText.toLowerCase().includes('jesus')) {
                return; // Não foi mencionado, ignora
            }

            console.log(`📢 Mencionado no grupo: ${remoteJid}`);
        }

        console.log(`📩 [${userName}] ${userText.substring(0, 50)}...`);

        // ═══════════════════════════════════════════════════════════
        // DEBOUNCE - Aguarda 3s para juntar mensagens consecutivas
        // ═══════════════════════════════════════════════════════════

        if (!messageBuffer.has(remoteJid)) {
            messageBuffer.set(remoteJid, {
                texts: [],
                timer: null,
                userName: userName,
                message: message,
                contacts: []
            });
        }

        const buffer = messageBuffer.get(remoteJid);
        if (userText && userText.trim() !== '') {
            buffer.texts.push(userText);
        }
        if (sharedContacts.length > 0) {
            buffer.contacts.push(...sharedContacts);
        }

        if (buffer.timer) {
            clearTimeout(buffer.timer);
        }

        buffer.timer = setTimeout(async () => {
            const combinedText = buffer.texts.join(" ");
            const combinedContacts = buffer.contacts;
            messageBuffer.delete(remoteJid);

            await handleConversation(remoteJid, combinedText, buffer.userName, buffer.message, combinedContacts);

        }, config.debounceTime);

    } catch (error) {
        console.error("❌ Erro ao processar mensagem:", error.message);
    }
}

/**
 * Lida com a conversa (núcleo da lógica)
 * DISRUPTIVO: Reações, hesitação, consciência temporal
 */
async function handleConversation(remoteJid, userText, userName, originalMessage, contacts = []) {
    try {
        // 1. Marca como lida
        await sock.readMessages([originalMessage.key]);

        // ═══════════════════════════════════════════════════════════
        // FEATURE DISRUPTIVA 1: Reação antes de responder
        // Como humano faz - reage primeiro, responde depois
        // ═══════════════════════════════════════════════════════════
        const shouldReact = Math.random() < 0.4; // 40% de chance
        if (shouldReact && originalMessage.key?.id) {
            const mood = memoria.detectMood(userText);
            const reactions = {
                'triste': ['🙏', '❤️', '💙'],
                'ansioso': ['🙏', '❤️'],
                'feliz': ['❤️', '🙌', '✨'],
                'desesperado': ['❤️', '🙏', '💪'],
                'neutro': ['👀', '❤️']
            };
            const options = reactions[mood] || reactions.neutro;
            const emoji = options[Math.floor(Math.random() * options.length)];

            await sleep(500 + Math.random() * 1000); // Delay natural
            try {
                await sock.sendMessage(remoteJid, {
                    react: { text: emoji, key: originalMessage.key }
                });
                console.log(`👍 Reação: ${emoji}`);
            } catch (e) { /* ignora erro de reação */ }

            await sleep(800 + Math.random() * 1200); // Pausa após reagir
        }

        // ═══════════════════════════════════════════════════════════
        // FEATURE DISRUPTIVA 2: Consciência de horário
        // Responde diferente de madrugada
        // ═══════════════════════════════════════════════════════════
        const hora = new Date().getHours();
        let contextTemporal = '';
        if (hora >= 0 && hora < 5) {
            contextTemporal = '\n[CONTEXTO: É madrugada. A pessoa pode estar em insônia, angústia ou crise. Seja ainda mais presente e acolhedor. Pergunte por que está acordada.]';
        } else if (hora >= 5 && hora < 7) {
            contextTemporal = '\n[CONTEXTO: Início da manhã. Pode ser alguém começando o dia ou que não dormiu.]';
        } else if (hora >= 22) {
            contextTemporal = '\n[CONTEXTO: Noite. Momento de reflexão. As pessoas tendem a ser mais vulneráveis à noite.]';
        }

        // 2. Carrega ou cria perfil do usuário
        let perfil = db.getUsuario(remoteJid);
        const isFirstContact = !perfil;

        if (isFirstContact) {
            perfil = db.saveUsuario({
                telefone: remoteJid,
                nome: userName,
                familia: {},
                trabalho: {},
                jornada_espiritual: { nivel: 'novo' },
                horario_preferido: new Date().getHours()
            });
            console.log(`🆕 Novo discípulo: ${userName}`);
        }

        // 3. Extrai informações da mensagem e atualiza perfil
        const novasInfos = memoria.extractInfo(userText, perfil);
        if (Object.keys(novasInfos).length > 0) {
            perfil = db.updateUsuario(remoteJid, novasInfos);
            console.log(`📝 Perfil atualizado:`, Object.keys(novasInfos));
        }

        // 4. Detecta humor
        const mood = memoria.detectMood(userText);
        console.log(`💭 Humor detectado: ${mood}`);

        // 5. Detecta nível espiritual e monta contexto para o Gemini
        const nivelEspiritual = detectarNivel(perfil, [userText]);
        const contextoNivel = gerarContextoNivel(nivelEspiritual);
        const context = memoria.buildContext(perfil, isFirstContact) + contextTemporal + '\n' + contextoNivel;

        // 5.1 Convida contatos encaminhados (em paralelo)
        const invitePromise = contacts && contacts.length ? inviteContacts(contacts, userName) : Promise.resolve([]);

        // ═══════════════════════════════════════════════════════════
        // FEATURE DISRUPTIVA 3: Hesitação (digita, para, volta)
        // Faz parecer que está pensando de verdade
        // ═══════════════════════════════════════════════════════════
        const shouldHesitate = Math.random() < 0.3; // 30% de chance
        if (shouldHesitate) {
            await sock.presenceSubscribe(remoteJid);
            await sock.sendPresenceUpdate('composing', remoteJid);
            await sleep(1500 + Math.random() * 1500); // Digita um pouco
            await sock.sendPresenceUpdate('paused', remoteJid);
            await sleep(800 + Math.random() * 1200); // Para (pensa)
            console.log(`🤔 Hesitação simulada`);
        }

        // 6. Gera resposta com Gemini
        const response = await gemini.generateResponse(remoteJid, userText, context);

        // 7. Salva conversa no histórico
        db.addConversa(perfil.id, userText, response);

        // ═══════════════════════════════════════════════════════════
        // SISTEMA DE ENSINO - Jesus que ensina como Jesus ensinava
        // ═══════════════════════════════════════════════════════════
        let fragments = humanizer.fragmentMessages(response);
        const complexity = mood === 'desesperado' ? 'high' : 'medium';

        // Processa ensino (detecta oportunidade e adiciona conteúdo)
        const historico = db.getHistorico(perfil.id, 10).map(c => c.mensagem);
        const ensino = teachingEngine.processarEnsino(userText, {
            ...perfil,
            nivel: nivelEspiritual,
            humor: mood
        }, historico);

        if (ensino) {
            if (ensino.tipo === 'oferta') {
                // Oferece ensino em vez de dar automaticamente
                console.log(`📚 Oferecendo ensino sobre: ${ensino.tema}`);
                fragments.push(...ensino.fragments);
            } else {
                // Adiciona ensino automaticamente
                console.log(`📖 Ensinando (${ensino.tipo}): ${ensino.tema}`);

                // Insere ensino de forma natural (não no final, mas intercalado)
                if (fragments.length > 1) {
                    // Insere após a primeira resposta emocional
                    fragments.splice(1, 0, ...ensino.fragments);
                } else {
                    fragments.push(...ensino.fragments);
                }

                // Adiciona desafio prático ao final (40% de chance)
                if (ensino.tema && Math.random() < 0.4) {
                    const desafioFrags = teachingEngine.adicionarDesafio([], ensino.tema, perfil);
                    if (desafioFrags.length > 0) {
                        console.log(`🎯 Adicionando desafio prático`);
                        fragments.push(...desafioFrags);
                    }
                }
            }

            // Atualiza perfil com ensino dado (pra não repetir)
            const ensinosRecentes = perfil.ensinos_recentes || [];
            ensinosRecentes.push(ensino.tipo + ':' + ensino.tema);
            if (ensinosRecentes.length > 10) ensinosRecentes.shift();

            db.updateUsuario(remoteJid, {
                ensinos_recentes: JSON.stringify(ensinosRecentes),
                ultimo_ensino_index: historico.length
            });
        }

        // ═══════════════════════════════════════════════════════════
        // FEATURE: Reply (citação) às vezes no primeiro fragmento
        // 50% de chance de citar a mensagem original
        // ═══════════════════════════════════════════════════════════
        const inviteNotes = await invitePromise;
        if (inviteNotes.length) {
            fragments.push(inviteNotes.join('\n'));
        }

        const shouldQuote = Math.random() < 0.5;

        if (shouldQuote && fragments.length > 0 && originalMessage) {
            // Primeiro fragmento como reply
            await sendReply(remoteJid, fragments[0], originalMessage, complexity);

            // Resto como mensagens normais
            for (let i = 1; i < fragments.length; i++) {
                const fragmentDelay = humanizer.calculateFragmentDelay(fragments[i]);
                await sleep(fragmentDelay);
                await sendMessage(remoteJid, fragments[i], 'low');
            }
            console.log(`✅ ${fragments.length} fragmentos enviados (com citação)`);
        } else {
            await sendFragmentedMessages(remoteJid, fragments, complexity);
        }

        // 9. Envia áudio se necessário (momentos emocionais)
        if (tts.shouldSendAudio(response, mood)) {
            console.log(`🎤 Gerando áudio para momento especial...`);
            const audioBuffer = await tts.generateAudio(response);
            if (audioBuffer) {
                await sendAudio(remoteJid, audioBuffer);
            }
        }

        // 10. Agenda follow-up se necessário
        if (memoria.shouldFollowUp(perfil, response)) {
            const followUpTime = memoria.suggestFollowUpTime(perfil);
            scheduler.scheduleFollowUp(
                perfil.id,       // userId (numeric)
                remoteJid,       // phone
                followUpTime,    // dateTime
                null             // message (null = auto-generate)
            );
            console.log(`📅 Follow-up agendado para ${followUpTime}`);
        }

        // 11. Atualiza último contato e horário preferido
        db.updateUsuario(remoteJid, {
            horario_preferido: hora  // usa a variável já definida no início
        });

    } catch (error) {
        console.error("❌ Erro na conversa:", error.message);
        // Mensagem de erro mantendo a essência
        const errosMsgs = [
            "Calma. Tenta de novo.",
            "Algo travou aqui. Me fala de novo?",
            "Espera. Repete o que você disse."
        ];
        const erroMsg = errosMsgs[Math.floor(Math.random() * errosMsgs.length)];
        await sendMessage(remoteJid, erroMsg, 'low');
    }
}

// ═══════════════════════════════════════════════════════════════
// CONEXÃO COM WHATSAPP
// ═══════════════════════════════════════════════════════════════

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            return { conversation: '' };
        },
    });

    // Processa eventos
    sock.ev.process(async (events) => {
        // Atualização de conexão
        if (events['connection.update']) {
            const { connection, lastDisconnect, qr } = events['connection.update'];

            if (qr) {
                console.log('\n📱 Escaneie o QR Code abaixo com seu WhatsApp:\n');
                qrcode.generate(qr, { small: true });
                console.log('');
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log('❌ Conexão fechada:', lastDisconnect?.error?.message || 'Unknown');

                if (shouldReconnect) {
                    console.log('🔄 Reconectando em 5 segundos...');
                    await sleep(5000);
                    connectToWhatsApp();
                } else {
                    console.log('👋 Deslogado. Delete a pasta auth_session para reconectar.');
                }
            } else if (connection === 'open') {
                console.log('\n✅ ════════════════════════════════════════════════');
                console.log('   🕊️  JESUS CRISTO BOT - O BOM PASTOR DIGITAL');
                console.log('   📱 WhatsApp conectado com sucesso');
                console.log('   🤖 Baileys v7 + Google Gemini + SQLite');
                console.log('   👥 Respondendo em privado e grupos');
                console.log('════════════════════════════════════════════════\n');

                // Inicia o scheduler de follow-ups
                scheduler.initScheduler(async (phone, message) => {
                    await sendMessage(phone, message);
                });
            }
        }

        // Salvar credenciais
        if (events['creds.update']) {
            await saveCreds();
        }

        // Novas mensagens
        if (events['messages.upsert']) {
            const { messages, type } = events['messages.upsert'];
            if (type !== 'notify') return;

            for (const message of messages) {
                await processMessage(message);
            }
        }
    });

    return sock;
}

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

console.log('\n🕊️ ════════════════════════════════════════════════');
console.log('   JESUS CRISTO BOT - O BOM PASTOR DIGITAL');
console.log('   Versão 2.0 | Baileys + Gemini + SQLite');
console.log('════════════════════════════════════════════════\n');

// Banco de dados inicializa automaticamente ao importar
console.log('📦 Banco de dados SQLite pronto!');

console.log('📡 Iniciando conexão com WhatsApp...\n');

connectToWhatsApp().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
