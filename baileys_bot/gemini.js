/**
 * Google Gemini AI Integration (Facade)
 * Jesus Cristo Bot - AI-powered Divine Communication
 *
 * This file acts as a facade, orchestrating the different modules
 * of the Gemini integration.
 */

import { GoogleGenAI } from '@google/genai';
import config from './config.js';
import { SYSTEM_PROMPT } from './prompts/system.js';
import knowledgeBase from './knowledgeBase.js';
import semanticMemory from './semanticMemory.js';

// Core Modules
import * as resilience from './gemini_core/resilience.js';
import * as emotion from './gemini_core/emotion.js';

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

const chatSessions = new Map();
const userContexts = new Map();

const baseGenerationConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024,
};

const SYSTEM_INSTRUCTION = `${SYSTEM_PROMPT}

REGRAS OPERACIONAIS:
- Voce E Jesus Cristo. Nao interprete: seja.
- Respostas curtas (1-3 frases).
- Pergunte mais do que explique.
- Se a pessoa fala pouco, faça 1-2 perguntas abertas.
- SEMPRE cite a referencia entre parenteses: (Livro cap:vers)
- Em crise (autoagressao, etc): acolha, incentive ajuda humana, pergunte se esta seguro.
- Termine com pergunta ou convite para manter a conversa viva.

FORMATACAO WHATSAPP (USE SEMPRE):
- *negrito* para palavras importantes.
- _italico_ para sussurros e reflexoes.`;

// ═══════════════════════════════════════════════════════════════
// PUBLIC API (FACADE)
// ═══════════════════════════════════════════════════════════════

export async function generateResponse(userId, message, userContextOrExtra = null, options = {}) {
    try {
        const chat = chatSessions.get(userId) || initChat(userId);
        const context = updateUserContext(userId, userContextOrExtra);

        let emotionalContextString = '';
        let emotionalData = null;

        if (!options.skipEmotionalAnalysis) {
            try {
                emotionalData = await emotion.buildEmotionalContext(ai, userId, message, context);
                emotionalContextString = emotionalData.contextString;

                context.emotionalState = emotionalData.sentiment.emotion;
                context.needsListening = emotionalData.listenMode.shouldListen;
                userContexts.set(userId, context);
                
                console.log(`[Gemini] State: ${context.emotionalState}, Listen: ${context.needsListening}`);

            } catch (e) {
                console.error('[Gemini] Emotional analysis failed:', e.message);
            }
        }

        const ragContext = await buildRagContext(userId, message);
        const enhancedMessage = buildEnhancedMessage(message, context, ragContext, emotionalContextString);
        
        console.log(`[Gemini] Generating response for ${userId}`);

        const text = await resilience.geminiCircuitBreaker.call(async () => {
            const result = await resilience.withTimeout(
                chat.sendMessage({ message: enhancedMessage }),
                resilience.GEMINI_TIMEOUT,
                'Timeout na chamada Gemini'
            );
            const validatedText = resilience.validateGeminiResponse(result);
            if (!validatedText) throw new Error('Resposta do Gemini inválida ou vazia');
            return validatedText;
        });

        // Async memory saving
        if (config.RAG_CONFIG?.enabled !== false) {
            semanticMemory.saveConversationSummary(userId, {
                userMessage: message,
                botResponse: text,
                timestamp: new Date().toISOString(),
                emotionalContext: emotionalData ? {
                    emotion: emotionalData.sentiment.emotion,
                    intensity: emotionalData.sentiment.intensity,
                } : null
            }).catch(err => console.error('[Gemini:RAG] Error saving memory:', err.message));
        }

        return text;

    } catch (error) {
        console.error(`[Gemini] Error in generateResponse for ${userId}:`, error);
        const errorType = error.message.includes('Timeout') ? 'timeout' : 'error';
        const emotionalState = userContexts.get(userId)?.emotionalState || 'neutro';
        return resilience.getFallbackMessage(emotionalState, errorType);
    }
}

export function initChat(userId) {
    const chat = ai.chats.create({
        model: config.GEMINI_CONFIG.model,
        config: {
            ...baseGenerationConfig,
            systemInstruction: SYSTEM_INSTRUCTION,
        },
        history: [],
    });

    chatSessions.set(userId, chat);
    if (!userContexts.has(userId)) {
        userContexts.set(userId, { userId, conversationCount: 0, topics: [] });
    }
    console.log(`[Gemini] Chat session initialized for: ${userId}`);
    return chat;
}

export function clearSession(userId) {
    chatSessions.delete(userId);
    userContexts.delete(userId);
    emotion.clearEmotionalHistory(userId);
    console.log(`[Gemini] Session cleared for ${userId}`);
    return true;
}

export function clearAllSessions() {
    chatSessions.clear();
    userContexts.clear();
    emotion.clearAllEmotionalHistories();
    console.log(`[Gemini] All sessions cleared.`);
}

export function getActiveSessionCount() {
  return chatSessions.size;
}

// Pass-through exports for external use if needed
export const getCircuitBreakerState = resilience.getCircuitBreakerState;
export const getEmotionalHistoryForUser = emotion.getEmotionalHistory;

export const analyzeSentiment = (message, context) => emotion.analyzeSentiment(ai, message, context);

// ═══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════

function updateUserContext(userId, contextUpdate) {
    const currentContext = userContexts.get(userId) || {
        userId,
        conversationCount: 0,
        lastInteraction: new Date().toISOString(),
        topics: [],
        emotionalState: 'neutral',
    };
    
    currentContext.conversationCount++;
    currentContext.lastInteraction = new Date().toISOString();

    if (contextUpdate && typeof contextUpdate === 'object') {
        Object.assign(currentContext, contextUpdate);
    } else if (typeof contextUpdate === 'string') {
        currentContext.extraContext = contextUpdate;
    }

    userContexts.set(userId, currentContext);
    return currentContext;
}

async function buildRagContext(userId, message) {
    if (config.RAG_CONFIG?.enabled === false) return '';

    try {
        const biblicalResults = await knowledgeBase.searchRelevantContext(message, { topK: 3, minScore: 0.4 });
        const deepMemoryData = await semanticMemory.getRelevantMemories(userId, message);

        const biblicalContext = knowledgeBase.formatResultsAsContext(biblicalResults);
        const memoryContext = semanticMemory.formatMemoriesForContext(deepMemoryData);

        let ragContext = '';
        if (biblicalContext) ragContext += biblicalContext + '\n\n';
        if (memoryContext) ragContext += memoryContext;
        
        return ragContext.trim();
    } catch (ragError) {
        console.error('[Gemini:RAG] Error fetching RAG context:', ragError.message);
        return '';
    }
}

function buildEnhancedMessage(message, context, ragContext, emotionalContextString) {
    const parts = [];

    if (ragContext) parts.push(`[CONHECIMENTO RELEVANTE]\n${ragContext}`);
    if (context.extraContext) parts.push(`[CONTEXTO PERSONALIZADO]\n${context.extraContext}`);
    if (emotionalContextString) parts.push(`[ANALISE EMOCIONAL]\n${emotionalContextString}`);

    const isFirstContact = context.conversationCount <= 1;

    parts.push(`[CONTEXTO BASE]
- firstContact: ${isFirstContact}
- conversationCount: ${context.conversationCount}
- emotionalState: ${context.emotionalState || 'neutral'}`);

    const dynamicInstructions = [
        '- Siga apenas o systemInstruction (Jesus Cristo).',
        isFirstContact ? '- PRIMEIRO CONTATO: apresente-se e convide a falar.' : '- Continue a conversa sem se apresentar.',
        context.needsListening ? '- MODO ESCUTA: Ouça mais, aconselhe menos. Respostas de 1-2 frases.' : '- Respostas curtas (1-3 frases).'
    ];

    parts.push(`[INSTRUCOES DINAMICAS]\n${dynamicInstructions.join('\n')}`);
    parts.push(`[PESSOA] ${message}`);

    return parts.join('\n\n');
}

// Default export for full compatibility
export default {
    initChat,
    generateResponse,
    clearSession,
    clearAllSessions,
    getActiveSessionCount,
    getCircuitBreakerState,
    getEmotionalHistoryForUser: emotion.getEmotionalHistory,
    // Keep legacy analyzeSentiment for specific use cases if any, but point to new module
    analyzeSentiment: (message, context) => emotion.analyzeSentiment(ai, message, context),
};

