/**
 * 🕊️ JESUS CRISTO BOT - O BOM PASTOR DIGITAL
 * Orquestrador Principal (WhatsApp + Gemini)
 */

import makeWASocket, { DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, getContentType } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import NodeCache from 'node-cache';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import http from 'http';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logger = pino({ level: 'warn' });
const messageBuffer = new Map();
const msgRetryCounterCache = new NodeCache();
let sock = null;
let lastQR = null;
let connectionStatus = 'Desconectado';
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// ═══════════════════════════════════════════════════════════════
// SERVIDOR HTTP (Painel de Controle)
// ═══════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 8080;
const httpServer = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    
    if (req.url === '/qr') {
        if (connectionStatus === 'Conectado') {
            res.end('<h1>✅ WhatsApp já está conectado!</h1><p><a href="/">Ver Status</a></p>');
        } else if (lastQR) {
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQR)}`;
            res.end(`
                <div style="text-align: center; font-family: sans-serif; padding-top: 50px;">
                    <h1>🕊️ Escaneie para conectar Jesus</h1>
                    <img src="${qrImageUrl}" alt="QR Code" style="border: 10px solid white; box-shadow: 0 0 20px rgba(0,0,0,0.1);" />
                    <p style="margin-top: 20px;">Aponte seu WhatsApp para a imagem acima.</p>
                    <p><a href="/">Voltar ao Status</a></p>
                    <script>setTimeout(() => location.reload(), 20000);</script>
                </div>
            `);
        } else {
            res.end('<h1>⏳ Gerando QR Code...</h1><p>Aguarde 5 segundos.</p><script>setTimeout(() => location.assign("/qr"), 5000);</script>');
        }
    } else if (req.url === '/reset') {
        console.log('[System] Reset de sessão solicitado via Web');
        res.end('<h1>♻️ Reiniciando Sessão...</h1><p>O bot vai apagar a conexão atual e gerar um novo QR Code. Volte em 10 segundos.</p><script>setTimeout(() => location.assign("/qr"), 10000);</script>');
        
        if (sock) try { await sock.logout(); } catch(e) {}
        if (fs.existsSync(join(__dirname, 'auth_session'))) {
            fs.rmSync(join(__dirname, 'auth_session'), { recursive: true, force: true });
        }
        process.exit(0);
    } else {
        res.end(`
            <div style="text-align: center; font-family: sans-serif; padding-top: 50px;">
                <h1>🕊️ Jesus Cristo Bot Status</h1>
                <div style="padding: 20px; margin: 20px auto; max-width: 300px; border-radius: 10px; background: ${connectionStatus === 'Conectado' ? '#d4edda' : '#f8d7da'}; color: ${connectionStatus === 'Conectado' ? '#155724' : '#721c24'}; border: 1px solid ${connectionStatus === 'Conectado' ? '#c3e6cb' : '#f5c6cb'};">
                    Status: <strong>${connectionStatus}</strong>
                </div>
                ${connectionStatus !== 'Conectado' ? '<p><a href="/qr" style="display: inline-block; padding: 15px 30px; background: #25D366; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 1.2em;">CONECTAR AGORA</a></p>' : ''}
                <p style="margin-top: 20px;"><a href="/reset" style="color: #721c24; font-size: 0.8em;" onclick="return confirm('Isso vai desconectar o WhatsApp atual. Tem certeza?')">Forçar Nova Sincronização (Reset)</a></p>
                <p style="color: #666; font-size: 0.8em; margin-top: 50px;">Servindo ao Senhor com Inteligência Programática.</p>
            </div>
        `);
    }
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌍 Painel de Gerenciamento ativo na porta ${PORT}`);
});

// ═══════════════════════════════════════════════════════════════
// CONEXÃO WHATSAPP
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

    sock.ev.process(async (events) => {
        if (events['connection.update']) {
            const { connection, lastDisconnect, qr } = events['connection.update'];

            if (qr) {
                lastQR = qr;
                console.log('\n📱 QR Code gerado! Disponível em: http://185.194.216.184:8080/qr\n');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                connectionStatus = 'Desconectado';
                const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
                    setTimeout(connectToWhatsApp, delay);
                } else if (statusCode === DisconnectReason.loggedOut) {
                    console.log('👋 Deslogado. Limpando sessão...');
                    if (fs.existsSync(join(__dirname, 'auth_session'))) {
                        fs.rmSync(join(__dirname, 'auth_session'), { recursive: true, force: true });
                    }
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                connectionStatus = 'Conectado';
                lastQR = null;
                reconnectAttempts = 0;
                console.log('✅ WhatsApp Conectado!');
                scheduler.initScheduler(async (phone, message) => sender.sendMessage(sock, phone, message));
            }
        }

        if (events['creds.update']) await saveCreds();

        if (events['messages.upsert']) {
            const { messages, type } = events['messages.upsert'];
            if (type === 'notify') {
                for (const msg of messages) await processIncomingMessage(msg);
            }
        }

        if (events['presence.update']) {
            const { id, presences } = events['presence.update'];
            for (const [jid, presence] of Object.entries(presences)) {
                nudgeManager.updatePresence(jid, presence.lastKnownPresence);
                behaviorAnalyzer.onPresenceUpdate(jid, presence.lastKnownPresence);
                if (presence.lastKnownPresence === 'available') nudgeManager.checkAndScheduleNudge(sock, jid);
                if (presence.lastKnownPresence === 'composing') nudgeManager.cancelPendingNudge(jid);
            }
        }
    });

    return sock;
}

// ═══════════════════════════════════════════════════════════════
// ROTEAMENTO
// ═══════════════════════════════════════════════════════════════

async function processIncomingMessage(message) {
    const remoteJid = message.key.remoteJid;
    if (message.key.fromMe || !remoteJid) return;

    const msgContent = message.message;
    if (!msgContent) return;

    const contentType = getContentType(msgContent);
    let userText = '';
    let hasAudio = false;
    let sharedContacts = [];

    // Extração de Conteúdo (Texto, Imagem, Áudio, Contatos)
    if (contentType === 'conversation') {
        userText = msgContent.conversation;
    } else if (contentType === 'extendedTextMessage') {
        userText = msgContent.extendedTextMessage?.text;
    } else if (contentType === 'imageMessage') {
        userText = msgContent.imageMessage?.caption || '[Imagem]';
    } else if (contentType === 'audioMessage') {
        hasAudio = true;
        try {
            const audioResult = await audioProcessor.processAudioMessage(message, sock);
            userText = audioResult.text ? `[AUDIO TRANSCRITO]: ${audioResult.text}` : '[AUDIO recebido]';
        } catch (e) {
            userText = '[AUDIO recebido]';
        }
    } else if (contentType === 'contactMessage' || contentType === 'contactsArrayMessage') {
        const contacts = contentType === 'contactMessage' ? [msgContent.contactMessage] : msgContent.contactsArrayMessage.contacts;
        sharedContacts = contacts.map(c => ({
            name: flowUtils.normalizeContactName(c.displayName),
            jid: flowUtils.normalizeNumberWithCountry(flowUtils.extractNumberFromVcard(c.vcard)) + '@s.whatsapp.net',
            number: flowUtils.normalizeNumberWithCountry(flowUtils.extractNumberFromVcard(c.vcard))
        }));
        const names = sharedContacts.map(c => c.name).join(', ');
        userText = `Contatos encaminhados: ${names}`;
    }

    if (!userText && !hasAudio && sharedContacts.length === 0) return;

    // Comando /zerar
    if (userText?.trim().toLowerCase() === '/zerar') {
        const perfil = db.getUsuario(remoteJid);
        if (perfil) {
            db.deleteUsuario(perfil.id);
            await sender.sendMessage(sock, remoteJid, "ZERADO");
            await handleConversation(sock, remoteJid, "Olá", message.pushName, message, [], false, { isUrgent: true, urgencyLevel: 'critico', adjustedDebounce: 0 });
            return;
        }
    }

    // Debounce inteligente
    const urgency = flowUtils.detectUrgency(userText || '', remoteJid);
    if (!messageBuffer.has(remoteJid)) {
        messageBuffer.set(remoteJid, { texts: [], contacts: [], hasAudio, urgency });
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
    }, buffer.urgency.adjustedDebounce || 7000);
}

// Iniciar
process.on('SIGINT', () => { if(db) db.closeDatabase(); process.exit(0); });
connectToWhatsApp().catch(console.error);
