/**
 * JESUS CRISTO BOT - O BOM PASTOR DIGITAL
 * Orquestrador Principal (WAHA HTTP + Gemini)
 *
 * Arquitetura: Express HTTP Webhooks (não Baileys WebSocket)
 * - Recebe mensagens via POST /webhook/messages
 * - Processa com conversationController
 * - Envia via WAHA Client HTTP adapter
 * - Mantém scheduler para follow-ups automáticos
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Módulos internos
import config from './config.js';
import * as db from './database.js';
import * as scheduler from './scheduler.js';
import * as flowUtils from './flowUtils.js';
import * as sender from './whatsappSender.js';
import * as wahaClient from './wahaClient.js';
import { handleConversation } from './conversationController.js';
import * as mongoState from './mongoState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express App
const app = express();
const PORT = process.env.PORT || 8080;
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';

// Middleware
app.use(express.json());

// Estado global para dashboard
let messageBuffer = new Map();
let connectionStatus = 'Aguardando WAHA';
let connectedPhone = process.env.PHONE_NUMBER || 'N/A';
let messageCount = 0;
let startTime = Date.now();
let wahaHealthy = false;

// ═══════════════════════════════════════════════════════════════
// DASHBOARD HTTP
// ═══════════════════════════════════════════════════════════════

const htmlTemplate = (content) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="15">
    <title>Jesus Cristo Bot - Dashboard (WAHA)</title>
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
        .header .subtitle { color: #888; font-size: 0.9em; }
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
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .stat-box {
            background: rgba(0,255,136,0.1);
            border-radius: 10px;
            padding: 15px;
            text-align: center;
        }
        .stat-value { font-size: 2em; font-weight: bold; color: #00ff88; }
        .stat-label { color: #888; font-size: 0.9em; }
        .info-box {
            background: rgba(0,170,255,0.1);
            border-left: 4px solid #00aaff;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 10px 10px 0;
        }
        .soul-view { margin-top: 30px; background: rgba(255,255,255,0.05); border-radius: 15px; padding: 20px; }
        .soul-card { border-bottom: 1px solid rgba(255,255,255,0.1); padding: 15px 0; }
        .soul-card:last-child { border-bottom: none; }
        .soul-name { font-weight: bold; color: #00aaff; font-size: 1.1em; }
        .soul-pain { color: #ff6666; font-size: 0.9em; font-style: italic; }
        .soul-hope { color: #00ff88; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🕊️ Jesus Cristo Bot</h1>
            <p class="subtitle">O Bom Pastor Digital (WAHA Mode)</p>
        </div>
        ${content}
    </div>
</body>
</html>
`;

// ═══════════════════════════════════════════════════════════════
// ENDPOINTS EXPRESS
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        waha: wahaHealthy,
        mode: 'webhook',
        uptime: Math.floor((Date.now() - startTime) / 1000)
    });
});

// Dashboard principal
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    let content = '';

    if (connectionStatus === 'Conectado') {
        const uptime = Math.floor((Date.now() - startTime) / 1000 / 60);

        let soulsHtml = '';
        try {
            const souls = db.db.prepare(`
                SELECT u.nome, u.telefone, p.core_pain, p.core_hope, p.spiritual_stage
                FROM usuarios u
                LEFT JOIN user_deep_profile p ON u.telefone = p.jid
                ORDER BY u.ultimo_contato DESC
                LIMIT 5
            `).all();

            soulsHtml = `
                <div class="soul-view">
                    <h3>👥 Visao de Almas (Recentes)</h3>
                    ${souls.map(s => `
                        <div class="soul-card">
                            <div class="soul-name">${s.nome || 'Buscador'} (${s.telefone})</div>
                            <div class="soul-pain">💔 Dor: ${s.core_pain || 'Analizando...'}</div>
                            <div class="soul-hope">✨ Busca: ${s.core_hope || 'Analizando...'}</div>
                            <div style="font-size:0.8em; color:#888;">Estagio: ${s.spiritual_stage || 'Inicial'}</div>
                        </div>
                    `).join('')}
                    <div style="text-align:center; padding-top:10px;">
                        <small style="color:#666">IA atualiza perfis automaticamente a cada 5 interacoes.</small>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error('Erro ao buscar almas:', e.message);
        }

        content = `
            <div class="status-card">
                <h2><span class="status-indicator status-connected"></span>Conectado (WAHA)</h2>
                <p style="margin-top:10px">Telefone: ${connectedPhone}</p>
                <p style="margin-top:5px; font-size:0.9em; color:#888;">Sessao: ${WAHA_SESSION}</p>
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
            <div class="info-box">
                <strong>Configuracao WAHA:</strong><br>
                Endpoint: ${WAHA_URL}<br>
                Sessao: ${WAHA_SESSION}<br>
                Webhook: /webhook/messages
            </div>
            ${soulsHtml}
        `;
    } else {
        content = `
            <div class="status-card">
                <h2><span class="status-indicator status-waiting"></span>Aguardando WAHA</h2>
                <p style="margin-top:10px">Status: ${connectionStatus}</p>
            </div>
            <div class="info-box">
                <strong>Proximas etapas:</strong><br>
                1. Verifique se WAHA esta rodando em ${WAHA_URL}<br>
                2. Configure webhook para: http://your-domain/webhook/messages<br>
                3. Envie uma mensagem para testar
            </div>
        `;
    }

    res.end(htmlTemplate(content));
});

// Webhook para receber mensagens do WAHA
app.post('/webhook/messages', async (req, res) => {
    const event = req.body;

    console.log('[WAHA Webhook]', event.event, event.data?.from);

    if (!event.event || !event.data) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Marca WAHA como saudavel
    wahaHealthy = true;

    // Atualiza status de conexao
    if (connectionStatus !== 'Conectado') {
        connectionStatus = 'Conectado';
        startTime = Date.now();
        console.log('✅ WAHA conectado e recebendo webhooks');
    }

    try {
        if (event.event === 'message') {
            const { data } = event;
            const { from, body } = data;

            if (!from || !body) {
                return res.json({ status: 'ignored' });
            }

            messageCount++;
            await processIncomingMessage(from, body, data);
            return res.json({ status: 'processed' });
        }
        else if (event.event === 'message_ack') {
            // Confirmacao de entrega - ignorar
            return res.json({ status: 'ack_received' });
        }
        else {
            return res.json({ status: 'ignored', reason: 'unknown_event' });
        }
    } catch (error) {
        console.error('[Webhook Error]', error.message);
        return res.status(500).json({ error: error.message });
    }
});

// Heartbeat do WAHA
app.post('/webhook/health', (req, res) => {
    wahaHealthy = true;
    res.json({ status: 'ok' });
});

// ═══════════════════════════════════════════════════════════════
// PROCESSAMENTO DE MENSAGENS
// ═══════════════════════════════════════════════════════════════

/**
 * Processa mensagem recebida do webhook WAHA
 * - Valida e normaliza JID (WhatsApp format)
 * - Aplica debounce inteligente (urgência define timing)
 * - Chama handleConversation com parâmetros esperados
 */
async function processIncomingMessage(jid, body, wahaData = {}) {
    // Validação básica
    if (!jid || !body) return;

    // Normaliza JID para formato WhatsApp (@s.whatsapp.net para individual, @g.us para grupo)
    let remoteJid = jid;
    if (!remoteJid.includes('@')) {
        remoteJid = jid.includes('-') ? `${jid}@g.us` : `${jid}@s.whatsapp.net`;
    }

    const userText = body.trim();
    if (!userText) return;

    // Detecção de urgência (ajusta debounce dinamicamente)
    const urgency = flowUtils.detectUrgency(userText, remoteJid);

    // Debounce inteligente - acumula mensagens rápidas
    if (!messageBuffer.has(remoteJid)) {
        messageBuffer.set(remoteJid, { texts: [], contacts: [], hasAudio: false, urgency });
    }

    const buffer = messageBuffer.get(remoteJid);
    buffer.texts.push(userText);
    if (urgency.urgencyScore > buffer.urgency.urgencyScore) {
        buffer.urgency = urgency;
    }

    // Limpa timer anterior se existir
    if (buffer.timer) clearTimeout(buffer.timer);

    // Define novo timer com debounce ajustado pela urgência
    buffer.timer = setTimeout(async () => {
        try {
            const data = { ...buffer };
            messageBuffer.delete(remoteJid);

            // Extrai nome do usuário (vem no evento WAHA como pushName)
            const userName = wahaData.pushName || wahaData.name || 'Amigo(a)';

            // Chama handleConversation - padrão: sock=null para WAHA
            await handleConversation(
                null,                           // sock = null (WAHA não precisa socket)
                remoteJid,                      // JID do usuário (telefone@s.whatsapp.net)
                data.texts.join(" "),           // Mensagens concatenadas
                userName,                       // Nome do usuário
                wahaData,                       // Dados originais do evento WAHA
                data.contacts,                  // Contatos extraídos (se houver)
                data.hasAudio,                  // Flag audio (transcrito em audioProcessor)
                data.urgency                    // Dados de urgência/crisis
            );
        } catch (error) {
            console.error('[MessageBuffer] Erro ao processar conversa:', error.stack || error);
        }
    }, buffer.urgency.adjustedDebounce || 1500);
}


// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO & CLEANUP
// ═══════════════════════════════════════════════════════════════

process.on('SIGINT', async () => {
    console.log('\n👋 Encerrando Jesus Cristo Bot...');
    try {
        if (db?.closeDatabase) db.closeDatabase();
        if (mongoState?.closeMongo) await mongoState.closeMongo();
    } catch (err) {
        console.error('Erro ao fechar recursos:', err.message);
    }
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});

// Inicia o servidor Express
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║    JESUS CRISTO BOT - O BOM PASTOR DIGITAL        ║');
    console.log('║           Modo: WAHA HTTP Webhooks                 ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    console.log('🔧 Configuração:');
    console.log(`  📱 WAHA Endpoint: ${WAHA_URL}`);
    console.log(`  🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`  📡 Webhook: POST /webhook/messages`);
    console.log(`  🔑 Session: ${WAHA_SESSION}`);
    console.log(`  🚀 Port: ${PORT}\n`);

    // Inicializa MongoDB (para embeddings e session state)
    try {
        await mongoState.connectMongo();
        console.log('✅ MongoDB conectado para embeddings/state');
    } catch (err) {
        console.error('⚠️  MongoDB indisponível:', err.message);
        console.error('   Continuando sem persistent storage...');
    }

    // Inicializa scheduler de follow-ups automáticos
    try {
        scheduler.initScheduler(async (phone, message) => {
            // Callback do scheduler: envia via WAHA usando sender
            await sender.sendMessage(null, phone, message, 'medium');
        });
        console.log('✅ Scheduler inicializado (follow-ups automáticos)');
    } catch (err) {
        console.error('⚠️  Scheduler falhou:', err.message);
    }

    console.log('\n🚀 Bot pronto! Aguardando webhooks do WAHA...\n');
});
