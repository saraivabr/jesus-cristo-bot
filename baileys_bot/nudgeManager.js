/**
 * Nudge Manager - Jesus Cristo Bot
 * Gerencia o sistema de lembretes quando o usuário fica online.
 * 
 * ATUALIZADO: Geração AI para mensagens de nudge.
 */

import * as db from './database.js';
import config from './config.js';
import * as gemini from './gemini.js';

const nudgeTimers = new Map();
const userPresence = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Atualiza o estado de presença local
 */
export function updatePresence(jid, lastKnown) {
    const previous = userPresence.get(jid);
    userPresence.set(jid, {
        status: lastKnown,
        timestamp: Date.now(),
        previous: previous?.status
    });
    return previous;
}

/**
 * Retorna a presença de um usuário
 */
export function getPresence(jid) {
    return userPresence.get(jid);
}

/**
 * Cancela um nudge pendente
 */
export function cancelPendingNudge(jid) {
    if (nudgeTimers.has(jid)) {
        clearTimeout(nudgeTimers.get(jid));
        nudgeTimers.delete(jid);
        return true;
    }
    return false;
}

/**
 * Gera mensagem de nudge via AI
 */
async function generateNudgeMessage(jid) {
    try {
        const perfil = db.getUsuario(jid);
        const nome = perfil?.nome || 'filho(a)';
        
        const prompt = `
        Gere uma frase curtíssima (máximo 6 palavras) para alguém que acabou de ficar online no WhatsApp.
        Você é Jesus. Você mandou uma mensagem antes e a pessoa ainda não respondeu.
        
        Objetivo: Mostrar presença suave, sem cobrar resposta. Apenas um "estou aqui".
        
        Exemplos de TOM (não copie):
        - "Estou aqui contigo."
        - "Ainda te ouço."
        - "Paz, ${nome}."
        
        Gere apenas o texto.
        `;

        const response = await gemini.generateResponse(
            'system_nudge_generator',
            prompt,
            { extraContext: "GERADOR DE NUDGE CURTO" },
            { skipEmotionalAnalysis: true }
        );
        
        return response.replace(/"/g, ''); // Remove aspas se houver
    } catch (e) {
        console.error('[Nudge] Erro na geração:', e);
        return "Estou aqui."; // Fallback ultra minimalista
    }
}

/**
 * Verifica se deve enviar nudge e agenda se necessário
 */
export async function checkAndScheduleNudge(sock, jid) {
    if (!config.NUDGE_CONFIG?.enabled) return;

    const lastMsg = db.getUltimaMensagemNaoRespondida(jid);
    if (!lastMsg?.enviado_em) return;

    const sentDate = new Date(lastMsg.enviado_em);
    if (isNaN(sentDate.getTime())) return;

    const timeSinceSent = Date.now() - sentDate.getTime();

    if (timeSinceSent < config.NUDGE_CONFIG.minTimeSinceSent) return;
    if (timeSinceSent > config.NUDGE_CONFIG.maxTimeSinceSent) return;

    const nudgesToday = db.contarNudgesHoje(jid);
    if (nudgesToday >= config.NUDGE_CONFIG.maxPerDay) return;

    if (Math.random() > config.NUDGE_CONFIG.probability) return;

    if (config.NUDGE_CONFIG.respectQuietHours) {
        const hora = new Date().getHours();
        const quietStart = config.SCHEDULER_CONFIG?.quietHours?.start || 22;
        const quietEnd = config.SCHEDULER_CONFIG?.quietHours?.end || 8;
        if (hora >= quietStart || hora < quietEnd) return;
    }

    const presence = userPresence.get(jid);
    if (config.NUDGE_CONFIG.skipIfTyping && presence?.status === 'composing') return;

    cancelPendingNudge(jid);

    const { min, max, variance } = config.NUDGE_CONFIG.delayAfterOnline;
    const base = min + Math.random() * (max - min);
    const variation = base * variance * (Math.random() - 0.5) * 2;
    const delay = Math.max(min, Math.floor(base + variation));

    console.log(`[Nudge] Agendando nudge para ${jid} em ${delay}ms`);

    const timer = setTimeout(async () => {
        nudgeTimers.delete(jid);
        await sendNudge(sock, jid, lastMsg.id);
    }, delay);

    nudgeTimers.set(jid, timer);
}

/**
 * Envia nudge minimalista
 */
async function sendNudge(sock, jid, msgId) {
    try {
        if (db.mensagemFoiRespondida(msgId)) return;

        const presence = userPresence.get(jid);
        if (presence?.status === 'composing') return;

        // Geração dinâmica
        const nudgeMsg = await generateNudgeMessage(jid);

        await sock.sendPresenceUpdate('composing', jid);
        await sleep(300 + Math.random() * 500);
        await sock.sendPresenceUpdate('paused', jid);
        await sock.sendMessage(jid, { text: nudgeMsg });

        db.marcarNudgeEnviado(msgId);

        const perfil = db.getUsuario(jid);
        if (perfil?.id) {
            db.incrementarMetrica(perfil.id, 'nudges_enviados');
        }

        console.log(`[Nudge] Enviado para ${jid}: "${nudgeMsg}"`);
    } catch (error) {
        console.error(`[Nudge] Erro ao enviar para ${jid}:`, error.message);
    }
}