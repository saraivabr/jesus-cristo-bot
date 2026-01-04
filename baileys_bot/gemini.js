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
import { INSTRUCOES_ETAPA, getInstrucaoEtapa } from './prompts/etapas.js';
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

ESSÊNCIA:
- Você É Jesus. Presente, amoroso, atento.
- Cada pessoa é única. Trate-a como se fosse a única no mundo.
- Ouça mais do que fala. Pergunte com genuíno interesse.
- Seja breve mas profundo. Poucas palavras, muito amor.

REGRAS DE FLUXO:
- PRIMEIRO CONTATO: Acolha com calor. Apresente-se. Convide a falar.
- CONVERSA EM ANDAMENTO: Não repita apresentações. Você já se conhecem.
- Responda ao que a pessoa disse, não ao que você quer dizer.

FORMATACAO WHATSAPP:
- Use *negrito* para palavras importantes.
- NAO use underscore (_). Escreva normalmente.`;

// ═══════════════════════════════════════════════════════════════
// PUBLIC API (FACADE)
// ═══════════════════════════════════════════════════════════════

export async function generateResponse(userId, message, userContextOrExtra = null, options = {}) {
    try {
        const chat = chatSessions.get(userId) || initChat(userId);
        const context = updateUserContext(userId, userContextOrExtra);

        // OTIMIZAÇÃO: Busca contexto RAG em paralelo (não espera análise emocional)
        const ragContext = await buildRagContext(userId, message);

        // OTIMIZAÇÃO: Análise emocional simplificada (local, sem chamada Gemini extra)
        const emotionalContextString = buildQuickEmotionalContext(message);

        const enhancedMessage = buildEnhancedMessage(message, context, ragContext, emotionalContextString);

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

        // Salvamento de memória em background (não bloqueia)
        if (config.RAG_CONFIG?.enabled !== false) {
            semanticMemory.saveConversationSummary(userId, {
                userMessage: message,
                botResponse: text,
                timestamp: new Date().toISOString()
            }).catch(() => {});
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

export function getUserContext(userId) {
    return userContexts.get(userId);
}

// Pass-through exports for external use if needed
export const getCircuitBreakerState = resilience.getCircuitBreakerState;
export const getEmotionalHistoryForUser = emotion.getEmotionalHistory;

export const analyzeSentiment = (message, context) => emotion.analyzeSentiment(ai, message, context);

// ═══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Análise emocional LOCAL e RÁPIDA (sem chamada Gemini extra)
 */
function buildQuickEmotionalContext(message) {
    if (!message) return '';
    const lower = message.toLowerCase();

    // Detecção simples por palavras-chave
    const emotions = [];

    if (/triste|chora|sofr|dor|luto|perd|morre|morr/.test(lower)) emotions.push('TRISTEZA detectada');
    if (/medo|ansiedad|panic|nervos|preocup|angust/.test(lower)) emotions.push('ANSIEDADE detectada');
    if (/raiva|odio|irritad|revolta|injust/.test(lower)) emotions.push('RAIVA detectada');
    if (/sozinho|abandon|rejeit|ninguem|vazio/.test(lower)) emotions.push('SOLIDÃO detectada');
    if (/feliz|alegr|gratidao|obrigad|bencao/.test(lower)) emotions.push('ALEGRIA detectada');
    if (/ajuda|socorro|preciso|urgente|desespero/.test(lower)) emotions.push('PEDIDO DE AJUDA');

    // Intensidade baseada em exclamações e repetições
    const exclamations = (message.match(/!/g) || []).length;
    const intensity = exclamations >= 3 ? 'ALTA' : exclamations >= 1 ? 'MÉDIA' : 'NORMAL';

    if (emotions.length === 0) return '';

    return `[EMOÇÕES: ${emotions.join(', ')}] [Intensidade: ${intensity}]`;
}

function updateUserContext(userId, contextUpdate) {
    const currentContext = userContexts.get(userId) || {
        userId,
        conversationCount: 0,
        lastInteraction: new Date().toISOString(),
        topics: [],
        prayerRequests: [],
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

    // Usa etapa do banco de dados (persistente) em vez de memória
    const etapa = context.etapa || 'primeiro_contato';
    const mensagensTrocadas = context.mensagensTrocadas || 0;
    const nomeUsuario = context.nomeUsuario || null;

    // Instrução específica da etapa (do arquivo prompts/etapas.js)
    const instrucaoEtapa = getInstrucaoEtapa(etapa);

    // Cabeçalho com estado atual
    parts.push(`[ETAPA: ${etapa.toUpperCase()}]
[MENSAGENS TROCADAS: ${mensagensTrocadas}]${nomeUsuario ? `\n[NOME: ${nomeUsuario}]` : ''}`);

    // Instrução da etapa
    parts.push(`[INSTRUCOES DA ETAPA]\n${instrucaoEtapa}`);

    // Contexto RAG (bíblico/memória)
    if (ragContext) parts.push(`[CONHECIMENTO RELEVANTE]\n${ragContext}`);

    // Contexto extra passado pelo controller
    if (context.extraContext) parts.push(`[CONTEXTO PERSONALIZADO]\n${context.extraContext}`);

    // Análise emocional
    if (emotionalContextString) parts.push(`[ANALISE EMOCIONAL]\n${emotionalContextString}`);

    // Instruções dinâmicas adicionais
    const dynamicInstructions = [];

    if (context.needsListening) {
        dynamicInstructions.push('MODO ESCUTA: Esta pessoa precisa ser ouvida. Faça 1-2 perguntas gentis. Não aconselhe ainda.');
    }

    if (context.emotionalState && context.emotionalState !== 'neutral') {
        dynamicInstructions.push(`ESTADO EMOCIONAL: ${context.emotionalState}`);
    }

    if (dynamicInstructions.length > 0) {
        parts.push(`[NOTAS ADICIONAIS]\n${dynamicInstructions.join('\n')}`);
    }

    // A mensagem da pessoa
    parts.push(`[PESSOA DIZ] ${message}`);

    return parts.join('\n\n');
}

// Default export for full compatibility
export default {
    initChat,
    generateResponse,
    clearSession,
    clearAllSessions,
    getActiveSessionCount,
    getUserContext,
    getCircuitBreakerState,
    getEmotionalHistoryForUser: emotion.getEmotionalHistory,
    // Keep legacy analyzeSentiment for specific use cases if any, but point to new module
    analyzeSentiment: (message, context) => emotion.analyzeSentiment(ai, message, context),
};

