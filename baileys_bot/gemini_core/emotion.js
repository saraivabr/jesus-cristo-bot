/**
 * Gemini Emotional Engine
 * Sentiment Analysis, Mood Tracking, and Empathy Logic
 */

import { GoogleGenAI } from '@google/genai';
import config from '../config.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const SENTIMENT_MODEL_NAME = config.GEMINI_CONFIG.model;

const sentimentGenerationConfig = {
    temperature: 0.3,
    topK: 20,
    topP: 0.9,
    maxOutputTokens: 256,
};

const SENTIMENT_ANALYSIS_PROMPT = `Voce e um analisador de emocoes especializado em portugues brasileiro.

Analise a mensagem e responda SOMENTE com um JSON puro (sem markdown, sem texto extra, sem comentarios). Use exatamente estas chaves:
{
  "emotion": "triste|ansioso|feliz|irritado|confuso|esperancoso|neutro|desesperado|com_medo|grato",
  "intensity": 1-10,
  "nuances": {
    "sarcasm": true|false,
    "irony": true|false,
    "ambivalence": true|false,
    "masking": true|false,
    "venting": true|false
  },
  "hiddenEmotion": "string|null",
  "confidence": 0-1,
  "detectedTopics": ["strings"]
}

Formato exemplo (use como molde, substitua os valores):
{"emotion":"neutro","intensity":5,"nuances":{"sarcasm":false,"irony":false,"ambivalence":false,"masking":false,"venting":false},"hiddenEmotion":null,"confidence":0.5,"detectedTopics":[]}

REGRAS:
- "ta otimo" sozinho com contexto negativo anterior = sarcasmo
- Frases curtas e secas apos assunto dificil = possivel masking
- Multiplas emocoes = ambivalence
- Textos longos sobre problemas sem pedir conselho = venting
- Considere girias brasileiras: "to mal", "to na bad", "suave", "de boa"
- Nao escreva nada alem do JSON final.`;

// ═══════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const emotionalHistories = new Map();

export function initEmotionalHistory(userId) {
    const history = {
        snapshots: [],
        trajectory: 'stable',
        sensitiveTopics: [],
        needsListening: false,
    };
    emotionalHistories.set(userId, history);
    return history;
}

export function getEmotionalHistory(userId) {
    return emotionalHistories.get(userId) || initEmotionalHistory(userId);
}

export function clearAllEmotionalHistories() {
    emotionalHistories.clear();
}

export function clearEmotionalHistory(userId) {
    if (emotionalHistories.has(userId)) {
        emotionalHistories.delete(userId);
        return true;
    }
    return false;
}

export function addSensitiveTopic(userId, topic) {
    const history = getEmotionalHistory(userId);
    if (!history.sensitiveTopics.includes(topic)) {
        history.sensitiveTopics.push(topic);
        emotionalHistories.set(userId, history);
    }
}

// ═══════════════════════════════════════════════════════════════
// ANALYSIS LOGIC
// ═══════════════════════════════════════════════════════════════

export async function analyzeSentiment(aiClient, message, previousContext = '') {
    try {
        const contextPrompt = previousContext
            ? `Contexto anterior da conversa:\n${previousContext}\n\nMensagem atual para analisar:\n${message}`
            : `Mensagem para analisar:\n${message}`;

        const result = await aiClient.models.generateContent({
            model: SENTIMENT_MODEL_NAME,
            systemInstruction: { role: 'system', parts: [{ text: SENTIMENT_ANALYSIS_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
            generationConfig: {
                ...sentimentGenerationConfig,
                responseMimeType: 'application/json',
            },
        });

        const response = result.text || (result.response && result.response.text && result.response.text());
        const analysis = parseSentimentJson(response);

        console.log(`[Emotion] Detected: ${analysis.emotion} (${analysis.intensity}/10)`);
        
        return {
            emotion: analysis.emotion || 'neutro',
            intensity: analysis.intensity || 5,
            nuances: analysis.nuances || {},
            hiddenEmotion: analysis.hiddenEmotion || null,
            confidence: analysis.confidence || 0.5,
            detectedTopics: analysis.detectedTopics || [],
        };
    } catch (error) {
        console.error('[Emotion] Error analyzing sentiment:', error.message);
        return fallbackSentimentAnalysis(message);
    }
}

export function detectMoodShift(userId, currentSnapshot) {
    const history = getEmotionalHistory(userId);
    const snapshots = history.snapshots;

    if (snapshots.length < 1) return { hasShift: false, direction: 'stable' };

    const previousEmotion = snapshots[snapshots.length - 1];
    const emotionValence = {
        desesperado: -5, triste: -3, com_medo: -3, ansioso: -2, irritado: -2,
        confuso: -1, neutro: 0, esperancoso: 2, grato: 3, feliz: 4,
    };

    const prevValence = emotionValence[previousEmotion.emotion] || 0;
    const currValence = emotionValence[currentSnapshot.emotion] || 0;
    const valenceDiff = currValence - prevValence;

    let direction = 'stable';
    if (valenceDiff >= 2) direction = 'improving';
    else if (valenceDiff <= -2) direction = 'worsening';

    history.trajectory = direction;
    emotionalHistories.set(userId, history);

    return { hasShift: direction !== 'stable', direction, summary: `De ${previousEmotion.emotion} para ${currentSnapshot.emotion}` };
}

export function adjustForSarcasm(sentiment) {
    if (!sentiment.nuances.sarcasm && !sentiment.nuances.irony) return sentiment;

    const invertedEmotions = { feliz: 'triste', grato: 'irritado', esperancoso: 'desesperado' };
    const adjusted = { ...sentiment };

    if (invertedEmotions[sentiment.emotion]) {
        adjusted.emotion = invertedEmotions[sentiment.emotion];
        adjusted.originalEmotion = sentiment.emotion;
        adjusted.wasInverted = true;
    }
    return adjusted;
}

export function shouldJustListen(message, sentiment) {
    const indicators = {
        venting: sentiment.nuances.venting,
        longMessage: message.length > 300,
        noQuestion: !message.includes('?'),
        intensePain: sentiment.intensity >= 7 && ['triste', 'desesperado'].includes(sentiment.emotion),
    };

    const count = Object.values(indicators).filter(Boolean).length;
    return count >= 2;
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT BUILDERS
// ═══════════════════════════════════════════════════════════════

export function generateEmpathyContext(userId, currentEmotion, userContext = {}) {
    const history = getEmotionalHistory(userId);
    const parts = [];

    const sensitiveMentions = currentEmotion.detectedTopics.filter(t => history.sensitiveTopics.includes(t));
    if (sensitiveMentions.length > 0) {
        parts.push(`[ALERTA EMPATICO] Tópico sensível mencionado: ${sensitiveMentions.join(', ')}.`);
    }
    if (history.trajectory === 'worsening') {
        parts.push('[TRAJETORIA] Pessoa está piorando. Acolha com mais cuidado.');
    }
    if (currentEmotion.intensity >= 8) {
        parts.push('[INTENSIDADE ALTA] Emoção muito intensa. Priorize acolhimento.');
    }

    return parts.join('\n');
}

export async function buildEmotionalContext(aiClient, userId, message, baseContext = {}) {
    const history = getEmotionalHistory(userId);
    const previousContext = history.snapshots.slice(-3).map(s => `[${s.emotion}] ${s.message.substring(0, 100)}`).join('\n');

    const sentiment = await analyzeSentiment(aiClient, message, previousContext);
    const adjustedSentiment = adjustForSarcasm(sentiment);

    const snapshot = { ...adjustedSentiment, message, timestamp: Date.now() };
    history.snapshots.push(snapshot);
    if (history.snapshots.length > 20) history.snapshots.shift();

    if (adjustedSentiment.intensity >= 7) {
        adjustedSentiment.detectedTopics.forEach(topic => addSensitiveTopic(userId, topic));
    }

    const moodShift = detectMoodShift(userId, snapshot);
    const needsListening = shouldJustListen(message, adjustedSentiment);
    history.needsListening = needsListening;

    const empathyContext = generateEmpathyContext(userId, adjustedSentiment, baseContext);

    const contextString = [
        `[ESTADO EMOCIONAL] ${adjustedSentiment.emotion} (intensidade: ${adjustedSentiment.intensity}/10)`,
        adjustedSentiment.wasInverted ? `[SARCASMO] Emoção real: ${adjustedSentiment.emotion}` : '',
        moodShift.hasShift ? `[MUDANCA DE HUMOR] ${moodShift.summary}` : '',
        needsListening ? '[MODO ESCUTA] A pessoa precisa desabafar. Ouça mais, aconselhe menos.' : '',
        empathyContext
    ].filter(Boolean).join('\n');

    return {
        sentiment: adjustedSentiment,
        moodShift,
        listenMode: { shouldListen: needsListening },
        contextString,
        history,
    };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function parseSentimentJson(response) {
    if (!response || typeof response !== 'string') throw new Error('Resposta vazia');
    let jsonStr = response.trim().replace(/^```json|^```|```$/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.warn('[Emotion] JSON parse failed, returning fallback.');
        return {
            emotion: 'neutro', intensity: 5, confidence: 0.3, detectedTopics: [],
            nuances: {}
        };
    }
}

function fallbackSentimentAnalysis(message) {
    const msgLower = message.toLowerCase();
    const keywords = {
        triste: ['triste', 'choro', 'depre'], ansioso: ['ansioso', 'medo'],
        feliz: ['feliz', 'alegria'], irritado: ['raiva', 'odio'],
    };
    let detected = 'neutro';
    for (const [emo, kws] of Object.entries(keywords)) {
        if (kws.some(kw => msgLower.includes(kw))) {
            detected = emo;
            break;
        }
    }
    return {
        emotion: detected, intensity: 5, confidence: 0.4, detectedTopics: [], nuances: {}
    };
}
