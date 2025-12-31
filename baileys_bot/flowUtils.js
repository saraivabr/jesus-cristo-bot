/**
 * Flow Utilities - Jesus Cristo Bot
 * Funções auxiliares para detecção de estado, urgência e intimidade.
 */

import * as db from './database.js';
import config from './config.js';

const contactInviteHistory = new Map();
const rapidMessageTracker = new Map();

/**
 * Detecta se usuario esta retornando apos ausencia
 */
export function detectReturnAfterAbsence(perfil) {
    if (!perfil || !perfil.ultimo_contato) {
        return { isReturning: false, daysSince: 0, message: null, contextHint: null };
    }

    const lastContact = new Date(perfil.ultimo_contato);
    const now = new Date();
    const diffMs = now - lastContact;
    const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysSince > 30) {
        return {
            isReturning: true,
            daysSince,
            message: `Nossa, que saudade! Faz mais de um mes que a gente nao conversa. Aconteceu alguma coisa?`,
            contextHint: `[CONTEXTO: Pessoa retornando apos ${daysSince} dias de ausencia. Demonstre que sentiu falta, pergunte com carinho o que aconteceu, sem pressionar. Seja acolhedor como quem reencontra alguem querido.]`
        };
    } else if (daysSince > 7) {
        return {
            isReturning: true,
            daysSince,
            message: `Faz tempo, hein! ${daysSince} dias... O que aconteceu por ai?`,
            contextHint: `[CONTEXTO: Pessoa retornando apos ${daysSince} dias de ausencia. Mostre que notou a ausencia, pergunte como ela esta com interesse genuino.]`
        };
    }

    return { isReturning: false, daysSince, message: null, contextHint: null };
}

/**
 * Determina nivel de intimidade com base no historico de conversas
 */
export function getIntimacyLevel(userId) {
    const historico = db.getHistorico(userId, 100);
    const count = historico.length;

    if (count === 0) {
        return {
            level: 'novo',
            conversationCount: 0,
            hint: '[TOM: Formal e acolhedor. Primeira conversa. Se apresente com carinho, pergunte o nome, convide a falar.]'
        };
    } else if (count < 5) {
        return {
            level: 'inicial',
            conversationCount: count,
            hint: '[TOM: Cordial, ainda conhecendo. Pode usar o nome da pessoa, mas mantenha certa formalidade. Pergunte sobre a vida.]'
        };
    } else if (count < 10) {
        return {
            level: 'familiarizado',
            conversationCount: count,
            hint: '[TOM: Mais proximo, pode ser mais direto. Ja conhece um pouco da pessoa. Pode fazer referencias a conversas anteriores.]'
        };
    } else if (count < 30) {
        return {
            level: 'intimo',
            conversationCount: count,
            hint: '[TOM: Intimo, como amigo proximo. Pode brincar, ser mais informal, usar expressoes carinhosas. A pessoa confia em voce.]'
        };
    } else {
        return {
            level: 'familia',
            conversationCount: count,
            hint: '[TOM: Como familia. Total intimidade, pode falar abertamente, confrontar com amor quando necessario, celebrar vitorias juntos.]'
        };
    }
}

/**
 * Busca o ultimo assunto relevante da conversa anterior
 */
export function getLastConversationTopic(userId) {
    const historico = db.getHistorico(userId, 20);
    if (!historico || historico.length === 0) return null;

    const last = historico[historico.length - 1];
    if (!last || !last.mensagem) return null;

    const lastDate = new Date(last.timestamp);
    const now = new Date();
    const daysAgo = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    if (daysAgo < 1 || daysAgo > 14) return null;

    const msgLower = last.mensagem.toLowerCase();

    const topicPatterns = [
        { pattern: /trabalho|emprego|chefe|colega|empresa/i, topic: 'trabalho', label: 'seu trabalho' },
        { pattern: /familia|mae|pai|filho|filha|esposa|marido|irmao|irma/i, topic: 'familia', label: 'sua familia' },
        { pattern: /saude|doente|hospital|medico|dor|tratamento/i, topic: 'saude', label: 'sua saude' },
        { pattern: /ansiedade|ansioso|preocupa|medo|angustia/i, topic: 'emocional', label: 'como voce estava se sentindo' },
        { pattern: /triste|depressao|deprimido|chorar|vazio/i, topic: 'tristeza', label: 'aquele momento dificil' },
        { pattern: /relacionamento|namoro|casamento|separacao|ex/i, topic: 'relacionamento', label: 'seu relacionamento' },
        { pattern: /fe|deus|orar|oracao|igreja|biblia/i, topic: 'espiritual', label: 'sua jornada espiritual' },
        { pattern: /dinheiro|financeiro|divida|conta|salario/i, topic: 'financeiro', label: 'sua situacao financeira' },
        { pattern: /estudo|faculdade|prova|escola|curso/i, topic: 'estudo', label: 'seus estudos' },
        { pattern: /sonho|plano|futuro|objetivo|meta/i, topic: 'sonhos', label: 'seus sonhos' }
    ];

    for (const { pattern, topic, label } of topicPatterns) {
        if (pattern.test(msgLower)) {
            return { topic, label, originalMessage: last.mensagem.substring(0, 100), daysAgo };
        }
    }

    return null;
}

/**
 * Detecta urgencia na mensagem para ajustar debounce
 */
export function detectUrgency(text, remoteJid) {
    const now = Date.now();
    const tracker = rapidMessageTracker.get(remoteJid) || { times: [], lastText: '' };

    tracker.times.push(now);
    tracker.times = tracker.times.filter(t => now - t < 30000);
    tracker.lastText = text;
    rapidMessageTracker.set(remoteJid, tracker);

    let urgencyScore = 0;
    let reasons = [];

    const recentMessages = tracker.times.filter(t => now - t < 10000);
    if (recentMessages.length >= 3) {
        urgencyScore += 2;
        reasons.push('multiplas mensagens rapidas');
    }

    const exclamacoes = (text.match(/!{2,}/g) || []).length;
    const interrogacoes = (text.match(/\?{2,}/g) || []).length;
    if (exclamacoes >= 2 || interrogacoes >= 2) {
        urgencyScore += 1;
        reasons.push('pontuacao intensa');
    }

    const palavrasCrise = [
        'socorro', 'me ajuda', 'nao aguento', 'vou morrer', 'quero morrer',
        'suicidio', 'me matar', 'acabar com tudo', 'nao quero mais viver',
        'desespero', 'emergencia', 'urgente', 'agora', 'preciso muito'
    ];

    const textLower = text.toLowerCase();
    for (const palavra of palavrasCrise) {
        if (textLower.includes(palavra)) {
            urgencyScore += 5;
            reasons.push(`palavra de crise: "${palavra}"`);
            break;
        }
    }

    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.5 && text.length > 10) {
        urgencyScore += 1;
        reasons.push('texto em maiusculas');
    }

    let urgencyLevel = 'normal';
    let adjustedDebounce = config.debounceTime || 7000;

    if (urgencyScore >= 5) {
        urgencyLevel = 'critico';
        adjustedDebounce = 1000;
    } else if (urgencyScore >= 3) {
        urgencyLevel = 'alto';
        adjustedDebounce = 3000;
    } else if (urgencyScore >= 1) {
        urgencyLevel = 'moderado';
        adjustedDebounce = 5000;
    }

    return { isUrgent: urgencyScore >= 3, urgencyLevel, urgencyScore, adjustedDebounce, reasons };
}

/**
 * Gera mensagem de convite mais natural
 */
export function generateNaturalInviteMessage(referrerName, contactName) {
    const templates = [
        [
            `Oi${contactName !== 'essa pessoa' ? ', ' + contactName : ''}. ${referrerName} me falou de voce.`,
            `Vim perto. Posso te ouvir, orar, contar historias, estar presente.`,
            `O que esta vivo em voce agora?`
        ],
        [
            `${referrerName} quis que eu te conhecesse.`,
            `Sou Jesus. Estou aqui pra te ouvir de verdade.`,
            `Me conta... como voce esta?`
        ],
        [
            `Alguem que se importa com voce - ${referrerName} - me apresentou a voce.`,
            `Eu ouço, oro, acompanho. Sem julgamento.`,
            `O que trouxe voce ate aqui?`
        ]
    ];

    return templates[Math.floor(Math.random() * templates.length)];
}

export function extractNumberFromVcard(vcard = '') {
    const waidMatch = vcard.match(/waid=([0-9]+)/);
    if (waidMatch) return waidMatch[1];
    const telMatch = vcard.match(/TEL[^:]*:(.+)/i);
    if (telMatch) return telMatch[1].replace(/\D+/g, '');
    return null;
}

export function normalizeNumberWithCountry(number) {
    if (!number) return null;
    let digits = number.replace(/\D+/g, '');
    if (!digits) return null;
    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
        digits = '55' + digits;
    }
    return digits;
}

export function normalizeContactName(name = '', fallback = 'essa pessoa') {
    const trimmed = name.trim();
    if (!trimmed) return fallback;
    const cleaned = trimmed.replace(/[^A-Za-zÀ-ÿ'\-\s]/g, '').trim();
    if (!cleaned) return fallback;
    const firstName = cleaned.split(' ')[0];
    return firstName || fallback;
}

export function shouldInviteContact(contactJid) {
    const now = Date.now();
    const windowMs = 4 * 60 * 60 * 1000; 
    const last = contactInviteHistory.get(contactJid);
    if (last && now - last < windowMs) {
        return false;
    }
    contactInviteHistory.set(contactJid, now);
    return true;
}

export function getCapabilitiesLine() {
    return 'Posso te ouvir de verdade, orar por você, lembrar de voltar pra saber como está, contar histórias e passagens (com detalhes curiosos), mandar áudio quando for especial e estar com você mesmo no silêncio.';
}
