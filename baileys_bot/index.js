/**
 * JESUS CRISTO BOT - O BOM PASTOR DIGITAL
 * Orquestrador Principal (WhatsApp + Gemini)
 *
 * ATUALIZADO: Suporte a Codigo de Pareamento + Dashboard
 */

import makeWASocket, { DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, getContentType } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import NodeCache from 'node-cache';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import http from 'http';
import readline from 'readline';

// Modulos internos
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

// Estado global
let sock = null;
let lastQR = null;
let pairingCode = null;
let connectionStatus = 'Desconectado';
let connectedPhone = null;
let reconnectAttempts = 0;
let messageCount = 0;
let startTime = Date.now();

const MAX_RECONNECT_ATTEMPTS = 5;
const PORT = process.env.PORT || 8080;

// Configuracao: usar codigo de pareamento ou QR
const USE_PAIRING_CODE = process.env.USE_PAIRING_CODE === 'true' || process.argv.includes('--pair');
const PHONE_NUMBER = process.env.PHONE_NUMBER || '5511980948484';

// ═══════════════════════════════════════════════════════════════
// DASHBOARD HTTP
// ═══════════════════════════════════════════════════════════════

const htmlTemplate = (content) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="10">
    <title>Jesus Cristo Bot - Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            color: #fff;
            padding: 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header .subtitle { color: #888; }
        .status-card {
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 20px;
            backdrop-filter: blur(10px);
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 10px;
            animation: pulse 2s infinite;
        }
        .status-connected { background: #00ff88; box-shadow: 0 0 10px #00ff88; }
        .status-disconnected { background: #ff4444; box-shadow: 0 0 10px #ff4444; }
        .status-waiting { background: #ffaa00; box-shadow: 0 0 10px #ffaa00; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .pairing-code {
            font-size: 3em;
            font-weight: bold;
            letter-spacing: 8px;
            text-align: center;
            background: linear-gradient(90deg, #00ff88, #00aaff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            padding: 20px;
            margin: 20px 0;
        }
        .qr-container { text-align: center; padding: 20px; }
        .qr-container img { max-width: 300px; border-radius: 10px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .stat-box {
            background: rgba(0,255,136,0.1);
            border-radius: 10px;
            padding: 15px;
            text-align: center;
        }
        .stat-value { font-size: 2em; font-weight: bold; color: #00ff88; }
        .stat-label { color: #888; font-size: 0.9em; }
        .instructions {
            background: rgba(255,170,0,0.1);
            border-left: 4px solid #ffaa00;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 10px 10px 0;
        }
        .btn {
            display: inline-block;
            padding: 12px 25px;
            background: linear-gradient(90deg, #ff4444, #ff6666);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin: 10px 5px;
            transition: transform 0.2s;
        }
        .btn:hover { transform: scale(1.05); }
        .btn-green { background: linear-gradient(90deg, #00aa44, #00ff88); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🕊️ Jesus Cristo Bot</h1>
            <p class="subtitle">O Bom Pastor Digital</p>
        </div>
        ${content}
    </div>
</body>
</html>
`;

const httpServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/reset') {
        console.log('[Dashboard] Reset solicitado');
        res.writeHead(200);
        res.end(htmlTemplate(`
            <div class="status-card">
                <h2>♻️ Reiniciando...</h2>
                <p>A sessao sera limpa e um novo codigo sera gerado.</p>
                <script>setTimeout(() => location.href = '/', 5000);</script>
            </div>
        `));

        setTimeout(async () => {
            if (sock) try { await sock.logout(); } catch(e) {}
            if (fs.existsSync(join(__dirname, 'auth_session'))) {
                fs.rmSync(join(__dirname, 'auth_session'), { recursive: true, force: true });
            }
            pairingCode = null;
            lastQR = null;
            connectionStatus = 'Desconectado';
            connectToWhatsApp();
        }, 1000);
        return;
    }

    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        return;
    }

    // Dashboard principal
    let content = '';

    if (connectionStatus === 'Conectado') {
        const uptime = Math.floor((Date.now() - startTime) / 1000 / 60);
        content = `
            <div class="status-card">
                <h2><span class="status-indicator status-connected"></span>Conectado</h2>
                <p style="margin-top:10px">Telefone: ${connectedPhone || 'N/A'}</p>
            </div>
            <div class="stats">
                <div class="stat-box">
                    <div class="stat-value">${messageCount}</div>
                    <div class="stat-label">Mensagens</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${uptime}m</div>
                    <div class="stat-label">Uptime</div>
                </div>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <a href="/reset" class="btn" onclick="return confirm('Desconectar o WhatsApp?')">Desconectar</a>
            </div>
        `;
    } else if (pairingCode) {
        content = `
            <div class="status-card">
                <h2><span class="status-indicator status-waiting"></span>Aguardando Pareamento</h2>
                <div class="pairing-code">${pairingCode}</div>
                <div class="instructions">
                    <strong>Como conectar:</strong>
                    <ol style="margin-left:20px; margin-top:10px;">
                        <li>Abra o WhatsApp no celular</li>
                        <li>Va em <b>Configuracoes > Dispositivos conectados</b></li>
                        <li>Toque em <b>Conectar dispositivo</b></li>
                        <li>Toque em <b>Conectar com numero de telefone</b></li>
                        <li>Digite o codigo acima</li>
                    </ol>
                </div>
            </div>
            <div style="text-align:center;">
                <a href="/reset" class="btn">Gerar Novo Codigo</a>
            </div>
        `;
    } else if (lastQR) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQR)}`;
        content = `
            <div class="status-card">
                <h2><span class="status-indicator status-waiting"></span>Escaneie o QR Code</h2>
                <div class="qr-container">
                    <img src="${qrUrl}" alt="QR Code">
                </div>
            </div>
            <div style="text-align:center;">
                <a href="/?pair=true" class="btn btn-green">Usar Codigo de Pareamento</a>
                <a href="/reset" class="btn">Resetar</a>
            </div>
        `;
    } else {
        content = `
            <div class="status-card">
                <h2><span class="status-indicator status-disconnected"></span>Desconectado</h2>
                <p>Aguardando inicializacao...</p>
            </div>
        `;
    }

    res.writeHead(200);
    res.end(htmlTemplate(content));
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 Dashboard: http://localhost:${PORT}`);
});

// ═══════════════════════════════════════════════════════════════
// CONEXAO WHATSAPP
// ═══════════════════════════════════════════════════════════════

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    const socketConfig = {
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        logger,
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage: async () => ({ conversation: '' }),
    };

    // Se usar codigo de pareamento, desabilita QR
    if (USE_PAIRING_CODE) {
        socketConfig.printQRInTerminal = false;
    }

    sock = makeWASocket(socketConfig);

    // Solicita codigo de pareamento se necessario
    if (USE_PAIRING_CODE && !sock.authState.creds.registered) {
        console.log('\n📱 Solicitando codigo de pareamento...');
        try {
            await new Promise(r => setTimeout(r, 2000));
            pairingCode = await sock.requestPairingCode(PHONE_NUMBER);
            console.log('\n════════════════════════════════════════');
            console.log('   🔑 CODIGO DE PAREAMENTO:', pairingCode);
            console.log('════════════════════════════════════════');
            console.log('\n📲 No WhatsApp: Configuracoes > Dispositivos > Conectar com numero\n');
        } catch (err) {
            console.error('❌ Erro ao solicitar codigo:', err.message);
        }
    }

    sock.ev.process(async (events) => {
        if (events['connection.update']) {
            const { connection, lastDisconnect, qr } = events['connection.update'];

            if (qr && !USE_PAIRING_CODE) {
                lastQR = qr;
                console.log('\n📱 QR Code gerado! Acesse o dashboard.\n');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                connectionStatus = 'Desconectado';
                pairingCode = null;
                const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log('❌ Conexao fechada:', lastDisconnect?.error?.message || 'Unknown');

                if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
                    console.log(`🔄 Reconectando em ${delay/1000}s...`);
                    setTimeout(connectToWhatsApp, delay);
                } else if (statusCode === DisconnectReason.loggedOut) {
                    console.log('👋 Deslogado. Limpando sessao...');
                    if (fs.existsSync(join(__dirname, 'auth_session'))) {
                        fs.rmSync(join(__dirname, 'auth_session'), { recursive: true, force: true });
                    }
                    setTimeout(connectToWhatsApp, 3000);
                }
            } else if (connection === 'open') {
                connectionStatus = 'Conectado';
                lastQR = null;
                pairingCode = null;
                reconnectAttempts = 0;
                startTime = Date.now();

                // Pega o numero conectado
                connectedPhone = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];

                console.log('\n✅ JESUS CRISTO BOT - ONLINE');
                console.log(`📱 Conectado: ${connectedPhone}`);
                console.log(`🌐 Dashboard: http://localhost:${PORT}\n`);

                scheduler.initScheduler(async (phone, message) => sender.sendMessage(sock, phone, message));
            }
        }

        if (events['creds.update']) await saveCreds();

        if (events['messages.upsert']) {
            const { messages, type } = events['messages.upsert'];
            if (type === 'notify') {
                for (const msg of messages) {
                    messageCount++;
                    await processIncomingMessage(msg);
                }
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

    // Extracao de Conteudo (Texto, Imagem, Audio, Contatos)
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
            await handleConversation(sock, remoteJid, "Ola", message.pushName, message, [], false, { isUrgent: true, urgencyLevel: 'critico', adjustedDebounce: 0 });
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

// ═══════════════════════════════════════════════════════════════
// INICIALIZACAO
// ═══════════════════════════════════════════════════════════════

process.on('SIGINT', () => {
    console.log('\n👋 Encerrando...');
    if(db) db.closeDatabase();
    httpServer.close();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('[FATAL]', err);
});

console.log('\n🕊️ JESUS CRISTO BOT');
console.log('═══════════════════════════════════════');
if (USE_PAIRING_CODE) {
    console.log('📱 Modo: Codigo de Pareamento');
    console.log(`📞 Telefone: ${PHONE_NUMBER}`);
} else {
    console.log('📱 Modo: QR Code');
}
console.log('═══════════════════════════════════════\n');

connectToWhatsApp().catch(console.error);
