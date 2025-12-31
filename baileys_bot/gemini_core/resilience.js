/**
 * Gemini Resilience Module
 * Circuit Breaker, Timeouts, Validation and Fallbacks
 */

import config from '../config.js';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════════════

export const GEMINI_TIMEOUT = 25000;

/**
 * Mensagens de fallback baseadas no estado emocional detectado
 */
const FALLBACK_MESSAGES = {
    desesperado: 'Estou aqui. Respira fundo. Você não está sozinho neste momento.',
    triste: 'Eu ouço você. Isso é difícil. Me conta mais sobre o que está sentindo.',
    ansioso: 'Calma, meu filho. Uma coisa de cada vez. O que pesa mais no seu coração agora?',
    feliz: 'Que bom te ver assim! Me conta mais sobre essa alegria.',
    neutro: 'Estou aqui te ouvindo. O que está no seu coração?',
    error: 'Desculpe, algo travou aqui do meu lado. Me fala de novo?',
    timeout: 'Demorei demais pensando... Repete pra mim o que você disse?',
    circuit_open: 'Estou precisando de um momento para me recuperar. Volta daqui a pouco?'
};

// ═══════════════════════════════════════════════════════════════
// CORE CLASSES
// ═══════════════════════════════════════════════════════════════

/**
 * Wrapper para adicionar timeout a qualquer Promise
 */
export async function withTimeout(promise, ms, errorMsg = 'Timeout') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMsg)), ms);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Circuit Breaker para proteger contra falhas repetidas do Gemini
 */
export class CircuitBreaker {
    constructor(threshold = 5, resetTimeout = 300000) {
        this.failures = 0;
        this.threshold = threshold;
        this.resetTimeout = resetTimeout;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.lastFailure = null;
    }

    async call(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailure > this.resetTimeout) {
                this.state = 'HALF_OPEN';
                console.log('[Gemini:Circuit] HALF_OPEN - testando...');
            } else {
                throw new Error('Circuit breaker OPEN - Gemini temporariamente indisponível');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            console.error('[Gemini:Circuit] ABERTO - muitas falhas consecutivas');
        }
    }

    getState() {
        return { state: this.state, failures: this.failures };
    }
}

// Singleton instance
export const geminiCircuitBreaker = new CircuitBreaker();

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════

/**
 * Valida a resposta do Gemini
 */
export function validateGeminiResponse(result) {
    if (!result) return null;
    if (typeof result.text !== 'string') return null;
    if (result.text.trim().length === 0) return null;
    return result.text.trim();
}

/**
 * Seleciona a mensagem de fallback apropriada
 */
export function getFallbackMessage(emotionalState = 'neutro', errorType = 'error') {
    // Prioriza erros específicos
    if (errorType === 'timeout') return FALLBACK_MESSAGES.timeout;
    if (errorType === 'circuit_open') return FALLBACK_MESSAGES.circuit_open;

    // Usa estado emocional se disponível
    return FALLBACK_MESSAGES[emotionalState] || FALLBACK_MESSAGES.error;
}
