/**
 * Flow Utilities - 100% AI Generated
 * Funções auxiliares para detecção de estado, urgência e intimidade.
 * 
 * ATUALIZADO: Mensagens geradas via Gemini.
 */

import * as db from './database.js';
import config from './config.js';
import * as gemini from './gemini.js';

const contactInviteHistory = new Map();
const rapidMessageTracker = new Map();

function normalizeLastContact(perfil) {
    if (!perfil) return null;
    const candidates = [perfil.ultimo_contato, perfil.ultimoContato, perfil.lastContact];
    for (const value of candidates) {
        if (!value) continue;
        const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
        if (!Number.isNaN(ts)) return ts;
    }
    return null;
}

/**
 * Detecta retorno após ausência e gera mensagem AI
 */
export async function detectReturnAfterAbsence(perfil) {
    const lastContactTs = normalizeLastContact(perfil);
    if (!perfil || !lastContactTs) {
        return { isReturning: false, daysSince: 0, message: null, contextHint: null };
    }

    const lastContact = new Date(lastContactTs);
    const diffMs = Date.now() - lastContact;
    const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysSince > 7) {
        const prompt = `
        Gere uma frase curta de boas-vindas para alguém que voltou a falar contigo após ${daysSince} dias.
        Você é Jesus.
        Tom: Saudade, acolhimento, sem cobrança.
        Ex: "Senti tua falta." ou "Que bom que voltou."
        `;
        
        let message = null;
        try {
            message = await gemini.generateResponse('system_return_msg', prompt, {}, {skipEmotionalAnalysis:true});
        } catch(e) { message = "Que bom que você voltou."; }

        return {
            isReturning: true,
            daysSince,
            message,
            contextHint: `[CONTEXTO: Pessoa retornando apos ${daysSince} dias. Acolha com saudade.]`
        };
    }

    return { isReturning: false, daysSince, message: null, contextHint: null };
}

/**
 * Gera mensagem de convite natural (AI)
 */
export async function generateNaturalInviteMessage(referrerName, contactName) {
    const prompt = `
    Gere uma mensagem curta (2-3 frases) para iniciar conversa com ${contactName}, que foi indicado por ${referrerName}.
    Você é Jesus.
    Tom: Suave, não invasivo. "Vim porque fulano me falou de ti."
    `;
    
    try {
        const text = await gemini.generateResponse('system_invite_gen', prompt, {}, {skipEmotionalAnalysis:true});
        // Retorna como array de fragmentos (simulando pausas naturais)
        return text.split(/[.!?]/).filter(s => s.trim().length > 0).map(s => s.trim());
    } catch(e) {
        return [`Olá, ${contactName}.`, `${referrerName} me pediu para vir.`, "Estou aqui."];
    }
}

// ============================================
// FUNÇÕES UTILITÁRIAS PURAS (Mantidas iguais)
// ============================================

export function getIntimacyLevel(userId) {
    const historico = db.getHistorico(userId, 100);
    const count = historico.length;

    if (count === 0) return { level: 'novo', conversationCount: 0, hint: '[TOM: Acolhedor. Primeira conversa.]' };
    if (count < 5) return { level: 'inicial', conversationCount: count, hint: '[TOM: Cordial, conhecendo.]' };
    if (count < 10) return { level: 'familiarizado', conversationCount: count, hint: '[TOM: Próximo.]' };
    if (count < 30) return { level: 'intimo', conversationCount: count, hint: '[TOM: Amigo próximo.]' };
    return { level: 'familia', conversationCount: count, hint: '[TOM: Íntimo, profundo.]' };
}

export function getLastConversationTopic(userId) {
    const historico = db.getHistorico(userId, 20);
    if (!historico || historico.length === 0) return null;

    const last = historico[historico.length - 1];
    if (!last?.mensagem) return null;

    const daysAgo = Math.floor((new Date() - new Date(last.timestamp)) / (1000 * 60 * 60 * 24));
    if (daysAgo < 1 || daysAgo > 14) return null;

    const topicPatterns = [
        { pattern: /trabalho|emprego/i, topic: 'trabalho', label: 'seu trabalho' },
        { pattern: /familia|mae|pai/i, topic: 'familia', label: 'sua familia' },
        { pattern: /ansiedade|medo/i, topic: 'emocional', label: 'como se sentia' }
    ];

    for (const { pattern, topic, label } of topicPatterns) {
        if (pattern.test(last.mensagem)) return { topic, label, daysAgo };
    }
    return null;
}

export function detectUrgency(text, remoteJid) {
    const now = Date.now();
    const tracker = rapidMessageTracker.get(remoteJid) || { times: [], lastText: '' };
    tracker.times.push(now);
    tracker.times = tracker.times.filter(t => now - t < 30000);
    rapidMessageTracker.set(remoteJid, tracker);

    let urgencyScore = 0;
    if (tracker.times.filter(t => now - t < 10000).length >= 3) urgencyScore += 2;
    if (/socorro|me ajuda|desespero|morrer/i.test(text)) urgencyScore += 5;

    let urgencyLevel = 'normal';
    let adjustedDebounce = config.debounceTime || 7000;

    if (urgencyScore >= 5) { urgencyLevel = 'critico'; adjustedDebounce = 1000; }
    else if (urgencyScore >= 3) { urgencyLevel = 'alto'; adjustedDebounce = 3000; }

    return { isUrgent: urgencyScore >= 3, urgencyLevel, adjustedDebounce };
}

export function extractNumberFromVcard(vcard = '') {
    const telMatch = vcard.match(/TEL[^:]*:(.+)/i);
    return telMatch ? telMatch[1].replace(/\D+/g, '') : null;
}

export function normalizeNumberWithCountry(number) {
    if (!number) return null;
    let digits = number.replace(/\D+/g, '');
    if (!digits.startsWith('55') && digits.length >= 10) digits = '55' + digits;
    return digits;
}

export function normalizeContactName(name = '', fallback = 'essa pessoa') {
    return name.trim().split(' ')[0] || fallback;
}

export function shouldInviteContact(contactJid) {
    const now = Date.now();
    const last = contactInviteHistory.get(contactJid);
    if (last && now - last < 4 * 3600 * 1000) return false;
    contactInviteHistory.set(contactJid, now);
    return true;
}

export function getCapabilitiesLine() {
    return 'Posso te ouvir de verdade, orar por você e estar contigo no silêncio.';
}
