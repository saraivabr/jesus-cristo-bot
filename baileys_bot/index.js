/**
 * 🕊️ JESUS CRISTO BOT - O BOM PASTOR DIGITAL
 * Orquestrador Principal (WhatsApp + Gemini)
 *
 * Módulo principal refatorado para focar apenas em conexão e roteamento.
 */

import makeWASocket, { DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, getContentType } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import NodeCache from 'node-cache';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { useVoiceCallsBaileys } from 'voice-calls-baileys';

// Módulos internos
import config from './config.js';
import * as db from './database.js';
import * as scheduler from './scheduler.js';
import * as behaviorAnalyzer from './behaviorAnalyzer.js';
import * as flowUtils from './flowUtils.js';
import * as sender from './whatsappSender.js';
import * as nudgeManager from './nudgeManager.js';
import * as audioProcessor from './audioProcessor.js';
import { handleConversation } from './conversationController.js';
import * as voiceCallHandler from './voiceCallHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logger = pino({ level: 'warn' });
const messageBuffer = new Map();
const msgRetryCounterCache = new NodeCache();
let sock = null;

// Controle de reconexão
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO E EVENTOS
// ═══════════════════════════════════════════════════════════════

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        logger,
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage: async () => ({ conversation: '' }),
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
        // Atualização de Conexão
        if (events['connection.update']) {
            const { connection, lastDisconnect, qr } = events['connection.update'];

            if (qr) {
                console.log('\n📱 Escaneie o QR Code abaixo com seu WhatsApp:\n');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log('❌ Conexão fechada:', lastDisconnect?.error?.message || 'Unknown');

                if (shouldReconnect) {
                    reconnectAttempts++;
                    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                        console.error('❌ Máximo de reconexões atingido. Reinicie manualmente.');
                        reconnectAttempts = 0;
                        return;
                    }
                    
                    // Backoff exponencial para evitar ban
                    const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
                    console.log(`🔄 Reconectando em ${delay / 1000}s (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                    await new Promise(r => setTimeout(r, delay));
                    connectToWhatsApp();
                } else {
                    console.log('👋 Deslogado. Delete a pasta auth_session para reconectar.');
                    reconnectAttempts = 0;
                }
            } else if (connection === 'open') {
                reconnectAttempts = 0;
                console.log('\n✅ JESUS CRISTO BOT - Online');
                console.log('   🕊️ O Bom Pastor Digital está ativo.\n');
                
                scheduler.initScheduler(async (phone, message) => sender.sendMessage(sock, phone, message));
            }
        }

        // Atualização de Credenciais
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

        // Recebimento de Mensagens
        if (events['messages.upsert']) {
            const { messages, type } = events['messages.upsert'];
            if (type === 'notify') {
                for (const msg of messages) {
                    await processIncomingMessage(msg);
                }
            }
        }

        // Atualização de Presença (Nudges e Comportamento)
        if (events['presence.update']) {
            const { id, presences } = events['presence.update'];
            for (const [jid, presence] of Object.entries(presences)) {
                nudgeManager.updatePresence(jid, presence.lastKnownPresence);
                behaviorAnalyzer.onPresenceUpdate(jid, presence.lastKnownPresence);
                
                if (presence.lastKnownPresence === 'available') {
                    nudgeManager.checkAndScheduleNudge(sock, jid);
                }
                if (presence.lastKnownPresence === 'composing') {
                    nudgeManager.cancelPendingNudge(jid);
                }
            }
        }

        // Atualização de Mensagens (Edição/Deleção)
        if (events['messages.update']) {
            for (const update of events['messages.update']) {
                if (update.update?.message) behaviorAnalyzer.onMessageEdited(update.key.remoteJid);
                if (update.update?.messageStubType === 1) behaviorAnalyzer.onMessageDeleted(update.key.remoteJid);
            }
        }
    });

    return sock;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSAMENTO DE MENSAGENS (ENTRY POINT)
// ═══════════════════════════════════════════════════════════════

async function processIncomingMessage(message) {
    const remoteJid = message.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    
    // Ignora mensagens próprias ou inválidas
    if (message.key.fromMe || !remoteJid) return;

    const msgContent = message.message;
    if (!msgContent) return;

    // Lógica de Grupo: Só responde se mencionado ou se chamarem por Jesus
    if (isGroup) {
        const botNumber = sock.user?.id?.split(':')[0];
        const mentioned = msgContent.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isMentioned = mentioned.some(jid => jid.includes(botNumber));
        
        // Se não foi mencionado, verifica se tem "Jesus" no texto
        // (Será verificado após extração do texto)
        if (!isMentioned) {
             // Verificação preliminar rápida para economizar processamento
             const textPreview = msgContent.conversation || msgContent.extendedTextMessage?.text || '';
             if (!textPreview.toLowerCase().includes('jesus')) {
                 return;
             }
        }
        console.log(`📢 Mencionado ou chamado no grupo: ${remoteJid}`);
    }

    const contentType = getContentType(msgContent);
    let userText = '';
    let sharedContacts = [];
    let hasAudio = false;

    // Extração de conteúdo
    if (contentType === 'conversation') {
        userText = msgContent.conversation;
    } else if (contentType === 'extendedTextMessage') {
        userText = msgContent.extendedTextMessage?.text;
    } else if (contentType === 'imageMessage') {
        userText = msgContent.imageMessage?.caption || '[Imagem recebida]';
    } else if (contentType === 'audioMessage') {
        hasAudio = true;
        try {
            console.log('[Audio] Processando audio recebido...');
            const audioResult = await audioProcessor.processAudioMessage(message, sock);
            if (audioResult.text) {
                userText = `[AUDIO TRANSCRITO]: ${audioResult.text}`;
                console.log(`[Audio] Transcrito: ${audioResult.text.substring(0, 50)}...`);
            } else {
                userText = '[AUDIO recebido - nao foi possivel transcrever] Responda acolhendo; diga que pode mandar audio e, se precisar, peca um resumo curto em texto.';
            }
        } catch (audioError) {
            console.error('[Audio] Erro ao processar:', audioError.message);
            userText = '[AUDIO recebido] Responda acolhendo; diga que pode mandar audio e, se precisar, peca um resumo curto em texto.';
        }
    } else if (contentType === 'contactMessage' || contentType === 'contactsArrayMessage') {
        const contacts = contentType === 'contactMessage' ? [msgContent.contactMessage] : msgContent.contactsArrayMessage.contacts;
        sharedContacts = contacts.map(c => ({
            name: flowUtils.normalizeContactName(c.displayName),
            jid: flowUtils.normalizeNumberWithCountry(flowUtils.extractNumberFromVcard(c.vcard)) + '@s.whatsapp.net',
            number: flowUtils.normalizeNumberWithCountry(flowUtils.extractNumberFromVcard(c.vcard))
        }));
        
        const names = sharedContacts.map(c => c.name).join(', ');
        userText = `Contatos encaminhados: ${names || 'sem nome'}`;
    }

    // Se após processamento não houver texto válido e nem contatos, ignora
    if ((!userText || userText.trim() === '') && sharedContacts.length === 0 && !hasAudio) return;

    // Comando /zerar (Reset total)
    if (userText?.trim().toLowerCase() === '/zerar') {
        const perfil = db.getUsuario(remoteJid);
        if (perfil) {
            db.deleteUsuario(perfil.id);
            console.log(`[/zerar] Usuário ${message.pushName} (${remoteJid}) resetado.`);
            await sender.sendMessage(sock, remoteJid, "Tudo bem. Deixei o passado para trás. Vamos começar de novo?\n\nA paz esteja contigo.\n\nO que está vivo em você agora?");
            return;
        }
    }

    // Debounce e roteamento para o controller
    const urgency = flowUtils.detectUrgency(userText || '', remoteJid);
    
    if (!messageBuffer.has(remoteJid)) {
        messageBuffer.set(remoteJid, {
            texts: [],
            contacts: [],
            hasAudio: false,
            urgency: urgency
        });
    }

    const buffer = messageBuffer.get(remoteJid);
    if (userText) buffer.texts.push(userText);
    if (sharedContacts.length > 0) buffer.contacts.push(...sharedContacts);
    if (hasAudio) buffer.hasAudio = true;
    if (urgency.urgencyScore > buffer.urgency.urgencyScore) buffer.urgency = urgency;

    if (buffer.timer) clearTimeout(buffer.timer);

    buffer.timer = setTimeout(async () => {
        const data = { ...buffer };
        messageBuffer.delete(remoteJid);
        
        await handleConversation(
            sock, 
            remoteJid, 
            data.texts.join(" "), 
            message.pushName || 'Filho(a)', 
            message, 
            data.contacts, 
            data.hasAudio, 
            data.urgency
        );
    }, buffer.urgency.adjustedDebounce);
}

// ═══════════════════════════════════════════════════════════════
// SHUTDOWN E START
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// SERVIDOR HTTP PARA HEALTH CHECK (Cloud Run)
// ═══════════════════════════════════════════════════════════════
import http from 'http';

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('🕊️ Jesus Cristo Bot está online e servindo ao Senhor.');
});

server.listen(PORT, () => {
    console.log(`\n🌍 Servidor Health Check rodando na porta ${PORT}`);
});

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

process.on('SIGINT', () => { 
    console.log('\n[Shutdown] Encerrando graciosamente...');
    db.closeDatabase(); 
    server.close();
    process.exit(0); 
});

process.on('uncaughtException', (err) => {
    console.error('[FATAL] Exceção não tratada:', err);
});

console.log('📡 Iniciando conexão...');
connectToWhatsApp().catch(err => { 
    console.error('❌ Erro fatal:', err); 
    process.exit(1); 
});
