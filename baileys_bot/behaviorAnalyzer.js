/**
 * 🧠 BEHAVIOR ANALYZER - Advanced Predictive Intelligence
 * 
 * ATUALIZADO: Integração com Embeddings e Análise Semântica de Humor.
 * Agora detecta não apenas "como" a pessoa digita, mas a "oscilação da alma".
 */

import * as gemini from './gemini.js';
import * as db from './database.js';

const userBehaviors = new Map();
const lastMessageSentByBot = new Map();
const activeTyping = new Map();

function getOrCreateBehavior(jid) {
    if (!userBehaviors.has(jid)) {
        userBehaviors.set(jid, {
            jid,
            presence: { typingPatterns: [], onlineWithoutResponse: 0, responseTimes: [], lastSeen: Date.now() },
            messaging: { deletedMessages: 0, editedMessages: 0, audioCount: 0, textCount: 0, messageTimestamps: [] },
            psychodynamics: {
                emotional_baseline: 'neutral',
                current_oscillation: 'stable',
                masking_detected: false,
                urgency_level: 0
            },
            profile: { type: 'equilibrado', confidence: 0.5, lastUpdated: Date.now() }
        });
    }
    return userBehaviors.get(jid);
}

// ═══════════════════════════════════════════════════════════════
// INTEGRAÇÃO SEMÂNTICA (O Coração da Inteligência)
// ═══════════════════════════════════════════════════════════════

/**
 * Analisa a oscilação emocional profunda comparando a msg atual com o histórico
 */
export async function trackDeepEmotion(jid, currentMessage, detectedSentiment) {
    const behavior = getOrCreateBehavior(jid);
    const psych = behavior.psychodynamics;

    // 1. Detectar Mascaramento
    // Se a msg é curta/seca ("tô bem.") mas o Gemini detectou 'tristeza' ou 'ansiedade'
    const isShort = currentMessage.length < 15;
    const isHeavyEmotion = ['triste', 'ansioso', 'desesperado'].includes(detectedSentiment.emotion);
    
    if (isShort && isHeavyEmotion) {
        psych.masking_detected = true;
        console.log(`[Behavior] MASCARAMENTO detectado para ${jid}`);
    } else {
        psych.masking_detected = false;
    }

    // 2. Trajetória Emocional (Melhorando ou Piorando?)
    // Esta informação vem do gemini.js via buildEmotionalContext
    psych.current_oscillation = detectedSentiment.trajectory || 'stable';
    psych.emotional_baseline = detectedSentiment.emotion;

    updateProfile(jid);
}

// ═══════════════════════════════════════════════════════════════
// HOOKS E ADAPTAÇÃO
// ═══════════════════════════════════════════════════════════════

export function onPresenceUpdate(jid, status) {
    const behavior = getOrCreateBehavior(jid);
    behavior.presence.lastSeen = Date.now();
    
    if (status === 'composing' || status === 'recording') {
        if (!activeTyping.has(jid)) activeTyping.set(jid, { startedAt: Date.now(), cycles: 0 });
    } else if (status === 'paused') {
        const t = activeTyping.get(jid);
        if (t) t.cycles++;
    }
}

export function onMessageReceived(jid, text, isAudio = false) {
    const behavior = getOrCreateBehavior(jid);
    const now = Date.now();
    
    behavior.messaging.textCount++;
    if (isAudio) behavior.messaging.audioCount++;
    
    const typing = activeTyping.get(jid);
    if (typing) {
        behavior.presence.typingPatterns.push({ duration: now - typing.startedAt, cycles: typing.cycles });
        activeTyping.delete(jid);
    }
    
    updateProfile(jid);
}

export function onBotMessageSent(jid) {
    lastMessageSentByBot.set(jid, Date.now());
}

function updateProfile(jid) {
    const behavior = getOrCreateBehavior(jid);
    const psych = behavior.psychodynamics;
    
    // Lógica de perfil inteligente
    if (psych.masking_detected) {
        behavior.profile.type = 'ferido_escondido';
    } else if (psych.current_oscillation === 'worsening') {
        behavior.profile.type = 'em_declinio';
    } else if (psych.current_oscillation === 'improving') {
        behavior.profile.type = 'em_cura';
    } else {
        behavior.profile.type = 'estavel';
    }
    
    behavior.profile.lastUpdated = Date.now();
}

/**
 * Retorna o contexto comportamental PROFUNDO para o Gemini
 */
export function getResponseAdaptation(jid) {
    const behavior = getOrCreateBehavior(jid);
    const psych = behavior.psychodynamics;
    
    let contextString = `[ANÁLISE COMPORTAMENTAL PREDITIVA]\n`;
    contextString += `- Perfil: ${behavior.profile.type}\n`;
    contextString += `- Mascaramento: ${psych.masking_detected ? 'SIM (Pessoa diz que está bem mas a alma sofre)' : 'Não detectado'}\n`;
    contextString += `- Oscilação: ${psych.current_oscillation}\n`;
    
    if (psych.masking_detected) {
        contextString += `\n[INSTRUÇÃO]: Ela está tentando ser forte ou esconder a dor. Não a confronte bruscamente, mas mostre que você vê além das palavras dela.`;
    }
    
    return { contextString };
}

export function isTyping(jid) { return activeTyping.has(jid); }

/**
 * Aguarda o usuário parar de digitar (composing -> paused/available)
 * @param {string} jid - ID do usuário
 * @param {number} timeout - Tempo máximo de espera em ms
 * @returns {Promise<boolean>} - true se parou, false se timeout
 */
export async function waitForTypingEnd(jid, timeout = 30000) {
    const startTime = Date.now();
    const checkInterval = 500; // Verifica a cada 500ms

    while (activeTyping.has(jid)) {
        if (Date.now() - startTime > timeout) {
            console.log(`[Behavior] Timeout esperando ${jid} parar de digitar`);
            activeTyping.delete(jid); // Limpa para não travar
            return false;
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return true;
}

export default {
    onPresenceUpdate,
    onMessageReceived,
    onBotMessageSent,
    getResponseAdaptation,
    trackDeepEmotion,
    isTyping,
    waitForTypingEnd
};