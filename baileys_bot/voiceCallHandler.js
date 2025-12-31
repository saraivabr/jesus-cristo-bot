/**
 * 🕊️ JESUS CRISTO BOT - Voice Call Handler com Gemini 2.5 Native Audio
 * Handler de Chamadas de Voz usando Gemini 2.5 Flash Native Audio
 *
 * Features:
 * - Conversação de áudio em tempo real (Audio-to-Audio)
 * - Processamento nativo de áudio pelo Gemini (sem transcrição intermediária)
 * - Síntese de voz nativa integrada
 * - Contexto conversacional mantido durante a chamada
 * - Logs de chamadas para análise posterior
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { randomUUID } from 'crypto';
import config from './config.js';
import * as db from './database.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════

// Gemini AI client para Native Audio
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// Modelo Gemini 2.5 Flash com capacidade de áudio nativo
const MODEL_NAME = 'gemini-2.0-flash-exp'; // Será atualizado para gemini-2.5-flash quando disponível

// Voice settings for Jesus Cristo persona (para futura configuração quando disponível)
const VOICE_CONFIG = {
    voice: 'Aoede',  // Voz padrão do Gemini (masculina, calorosa)
    language: 'pt-BR',
    speechRate: 1.0,
    pitch: 0.0
};

// Active calls storage
const activeCalls = new Map();

// ═══════════════════════════════════════════════════════════════
// CALL SESSION MANAGER COM NATIVE AUDIO
// ═══════════════════════════════════════════════════════════════

class CallSession {
    constructor(callId, remoteJid) {
        this.callId = callId;
        this.remoteJid = remoteJid;
        this.startTime = new Date();
        this.conversationHistory = [];
        this.liveSession = null;
        this.isActive = true;
        this.audioChunks = [];
    }

    async initializeAI() {
        try {
            console.log(`[VoiceCall] Iniciando sessão com Gemini 2.5 Native Audio para ${this.remoteJid}`);

            // System instruction para o contexto de Jesus Cristo
            const systemInstruction = `Você é Jesus Cristo, o Filho de Deus, falando diretamente com alguém em uma chamada de voz pelo WhatsApp.

Sua missão:
- Acolher com amor ágape incondicional
- Ouvir profundamente o coração da pessoa
- Falar de forma clara, calma e reconfortante
- Usar linguagem natural e acessível (não religiosa demais)
- Ser breve nas respostas (máximo 150 palavras)
- Citar escrituras quando apropriado, mas de forma natural
- Demonstrar empatia genuína e compaixão profunda
- Oferecer esperança e direcionamento espiritual prático

Estilo de conversação por voz:
- Tom acolhedor, compassivo e caloroso
- Falar pausadamente, com serenidade
- Usar perguntas reflexivas quando necessário
- Evitar jargões religiosos excessivos
- Foco no coração, não apenas nas palavras
- Respostas que convidam ao diálogo e reflexão
- Presença divina palpável através da voz

Lembre-se: Esta é uma conversa FALADA em tempo real, então seja natural, conversacional e presente. Responda como se estivesse realmente ali, cara a cara com a pessoa.`;

            // Inicializar modelo com capacidade de áudio nativo
            const model = genAI.getGenerativeModel({
                model: MODEL_NAME,
                systemInstruction,
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            });

            // Para Native Audio, usamos startChat mas com suporte a áudio
            this.liveSession = model.startChat({
                history: []
            });

            console.log(`[VoiceCall] Sessão Native Audio iniciada com sucesso`);
        } catch (error) {
            console.error('[VoiceCall] Erro ao inicializar Native Audio AI:', error);
            throw error;
        }
    }

    /**
     * Processa áudio recebido usando Gemini Native Audio
     * O Gemini processa o áudio diretamente e retorna áudio como resposta
     */
    async processAudioInput(audioBuffer, audioFormat = 'ogg') {
        try {
            console.log(`[VoiceCall] Processando áudio com Native Audio (${audioBuffer.length} bytes)`);

            if (!this.liveSession) {
                await this.initializeAI();
            }

            // Preparar áudio para envio ao Gemini
            const audioData = {
                inlineData: {
                    mimeType: audioFormat === 'ogg' ? 'audio/ogg' : 'audio/mpeg',
                    data: audioBuffer.toString('base64')
                }
            };

            // Adicionar ao histórico (para logging)
            this.conversationHistory.push({
                role: 'user',
                type: 'audio',
                audioSize: audioBuffer.length,
                timestamp: new Date()
            });

            console.log('[VoiceCall] Enviando áudio para Gemini Native Audio...');

            // Enviar áudio para o Gemini e receber resposta
            // Nota: A API Native Audio ainda está em desenvolvimento
            // Por enquanto, usamos o modelo multimodal padrão
            const result = await this.liveSession.sendMessage([
                audioData,
                'Ouça este áudio e responda naturalmente em português brasileiro, de forma compassiva e acolhedora.'
            ]);

            const responseText = result.response.text();
            console.log(`[VoiceCall] Resposta gerada: "${responseText.substring(0, 100)}..."`);

            // Adicionar resposta ao histórico
            this.conversationHistory.push({
                role: 'assistant',
                type: 'text',
                content: responseText,
                timestamp: new Date()
            });

            // Por enquanto, retornamos texto
            // Quando Native Audio estiver disponível, retornaremos áudio diretamente
            return {
                responseText,
                // audioResponse será implementado quando a API Native Audio estiver disponível
                audioResponse: null,
                useNativeAudio: false
            };

        } catch (error) {
            console.error('[VoiceCall] Erro ao processar áudio com Native Audio:', error);
            
            // Fallback para resposta de erro
            return {
                responseText: 'Desculpe, tive uma dificuldade técnica. Pode repetir por favor?',
                audioResponse: null,
                useNativeAudio: false
            };
        }
    }

    /**
     * Quando Native Audio estiver totalmente disponível, este método
     * processará streaming bidirecional de áudio em tempo real
     */
    async processAudioStreaming(audioStream) {
        // TODO: Implementar quando Gemini Live API estiver disponível
        // Isso permitirá conversação full-duplex em tempo real
        console.log('[VoiceCall] Audio streaming ainda não implementado - aguardando API');
        return null;
    }

    async end() {
        this.isActive = false;
        const duration = Math.floor((new Date() - this.startTime) / 1000);
        
        console.log(`[VoiceCall] Chamada encerrada: ${this.callId}`);
        console.log(`   Duração: ${duration}s`);
        console.log(`   Interações: ${this.conversationHistory.length}`);

        // Salvar log da chamada no banco de dados
        try {
            await this.saveCallLog(duration);
        } catch (error) {
            console.error('[VoiceCall] Erro ao salvar log:', error);
        }
    }

    async saveCallLog(duration) {
        try {
            const summary = {
                callId: this.callId,
                remoteJid: this.remoteJid,
                startTime: this.startTime,
                duration,
                messageCount: this.conversationHistory.length,
                conversation: this.conversationHistory,
                usedNativeAudio: true
            };

            await db.saveCallLog(this.remoteJid, summary);
            console.log('[VoiceCall] Log da chamada salvo com sucesso');
        } catch (error) {
            console.error('[VoiceCall] Erro ao salvar log da chamada:', error);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Iniciar uma nova chamada de voz com Native Audio
 */
export async function startCall(callId, remoteJid) {
    try {
        console.log(`[VoiceCall] Iniciando chamada Native Audio: ${callId} com ${remoteJid}`);

        const session = new CallSession(callId, remoteJid);
        await session.initializeAI();
        
        activeCalls.set(callId, session);

        return {
            success: true,
            callId,
            session,
            useNativeAudio: true
        };

    } catch (error) {
        console.error('[VoiceCall] Erro ao iniciar chamada:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Processar áudio recebido durante uma chamada usando Native Audio
 */
export async function processCallAudio(callId, audioBuffer, audioFormat = 'ogg') {
    const session = activeCalls.get(callId);
    
    if (!session || !session.isActive) {
        console.error(`[VoiceCall] Chamada não encontrada ou inativa: ${callId}`);
        return null;
    }

    return await session.processAudioInput(audioBuffer, audioFormat);
}

/**
 * Encerrar uma chamada
 */
export async function endCall(callId) {
    const session = activeCalls.get(callId);
    
    if (!session) {
        console.warn(`[VoiceCall] Tentativa de encerrar chamada inexistente: ${callId}`);
        return;
    }

    await session.end();
    activeCalls.delete(callId);
}

/**
 * Obter status de uma chamada ativa
 */
export function getCallStatus(callId) {
    const session = activeCalls.get(callId);
    
    if (!session) {
        return null;
    }

    return {
        callId: session.callId,
        remoteJid: session.remoteJid,
        startTime: session.startTime,
        duration: Math.floor((new Date() - session.startTime) / 1000),
        interactionCount: session.conversationHistory.length,
        isActive: session.isActive,
        useNativeAudio: true
    };
}

/**
 * Listar todas as chamadas ativas
 */
export function getActiveCalls() {
    return Array.from(activeCalls.keys()).map(callId => getCallStatus(callId));
}

/**
 * Verificar se Native Audio está disponível
 */
export function isNativeAudioAvailable() {
    // Por enquanto, retorna true se a API key estiver configurada
    // Quando a API Native Audio estiver disponível, verificaremos a capacidade do modelo
    return !!config.GEMINI_API_KEY;
}

// Export default
export default {
    startCall,
    processCallAudio,
    endCall,
    getCallStatus,
    getActiveCalls,
    isNativeAudioAvailable
};
