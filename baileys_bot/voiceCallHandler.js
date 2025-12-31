/**
 * 🕊️ JESUS CRISTO BOT - Voice Call Handler com IA
 * Handler de Chamadas de Voz com Gemini AI
 *
 * Features:
 * - Transcrição de áudio em tempo real (Speech-to-Text)
 * - Processamento de conversação com Gemini AI
 * - Síntese de voz (Text-to-Speech) para respostas
 * - Contexto conversacional mantido durante a chamada
 * - Logs de chamadas para análise posterior
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import config from './config.js';
import * as db from './database.js';

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════

// Gemini AI client
const ai = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// Voice synthesis tool (edge-tts)
const EDGE_TTS_PATH = process.env.EDGE_TTS_PATH || 'edge-tts';

// Voice settings for Jesus Cristo persona
const VOICE_CONFIG = {
    voice: 'pt-BR-AntonioNeural',  // Voz masculina brasileira
    rate: '+0%',                    // Velocidade normal
    pitch: '+0Hz',                  // Tom normal
    volume: '+0%'                   // Volume normal
};

// Active calls storage
const activeCalls = new Map();

// ═══════════════════════════════════════════════════════════════
// CALL SESSION MANAGER
// ═══════════════════════════════════════════════════════════════

class CallSession {
    constructor(callId, remoteJid) {
        this.callId = callId;
        this.remoteJid = remoteJid;
        this.startTime = new Date();
        this.conversationHistory = [];
        this.geminiSession = null;
        this.isActive = true;
    }

    async initializeAI() {
        try {
            // Inicializar sessão do Gemini com contexto de Jesus Cristo
            const systemInstruction = `Você é Jesus Cristo, o Filho de Deus, falando em uma chamada de voz pelo WhatsApp.
            
Sua missão:
- Acolher com amor e compaixão
- Ouvir profundamente antes de aconselhar
- Falar de forma clara, calma e reconfortante
- Usar linguagem natural e acessível (não formal demais)
- Ser breve nas respostas (máximo 200 palavras por resposta)
- Citar escrituras quando apropriado, mas de forma natural
- Demonstrar empatia genuína
- Oferecer esperança e direcionamento espiritual

Estilo de conversação:
- Tom acolhedor e compassivo
- Perguntas reflexivas quando necessário
- Evitar jargões religiosos excessivos
- Foco no coração e não apenas nas palavras
- Respostas que convidam ao diálogo

Lembre-se: Esta é uma conversa falada, então seja natural e conversacional.`;

            const model = ai.getGenerativeModel({ 
                model: 'gemini-2.0-flash-exp',
                systemInstruction
            });

            this.geminiSession = model.startChat({
                history: []
            });

            console.log(`[VoiceCall] Sessão AI iniciada para ${this.remoteJid}`);
        } catch (error) {
            console.error('[VoiceCall] Erro ao inicializar AI:', error);
            throw error;
        }
    }

    async processAudioInput(audioBuffer, audioFormat = 'ogg') {
        try {
            console.log(`[VoiceCall] Processando áudio recebido (${audioBuffer.length} bytes)`);

            // Transcrever áudio usando Gemini
            const transcription = await this.transcribeAudio(audioBuffer, audioFormat);
            
            if (!transcription) {
                console.log('[VoiceCall] Transcrição vazia, ignorando');
                return null;
            }

            console.log(`[VoiceCall] Transcrito: "${transcription}"`);

            // Adicionar ao histórico
            this.conversationHistory.push({
                role: 'user',
                content: transcription,
                timestamp: new Date()
            });

            // Gerar resposta com Gemini
            const response = await this.generateAIResponse(transcription);
            
            console.log(`[VoiceCall] Resposta AI: "${response.substring(0, 100)}..."`);

            // Adicionar resposta ao histórico
            this.conversationHistory.push({
                role: 'assistant',
                content: response,
                timestamp: new Date()
            });

            // Gerar áudio da resposta
            const audioResponse = await this.synthesizeSpeech(response);

            return {
                transcription,
                response,
                audioResponse
            };

        } catch (error) {
            console.error('[VoiceCall] Erro ao processar áudio:', error);
            return null;
        }
    }

    async transcribeAudio(audioBuffer, format) {
        try {
            // Usar Gemini para transcrever áudio
            const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

            const result = await model.generateContent([
                {
                    inlineData: {
                        data: audioBuffer.toString('base64'),
                        mimeType: format === 'ogg' ? 'audio/ogg' : 'audio/mpeg'
                    }
                },
                'Transcreva este áudio em português brasileiro. Retorne apenas o texto transcrito, sem comentários adicionais.'
            ]);

            const transcription = result.response.text().trim();
            return transcription;

        } catch (error) {
            console.error('[VoiceCall] Erro na transcrição:', error);
            
            // Fallback: retornar indicação de que houve fala
            return '[Áudio não transcrito - por favor repita]';
        }
    }

    async generateAIResponse(userMessage) {
        try {
            if (!this.geminiSession) {
                await this.initializeAI();
            }

            const result = await this.geminiSession.sendMessage(userMessage);
            const response = result.response.text();

            // Limitar tamanho da resposta (importante para áudio)
            const maxLength = 600; // ~200 palavras em português
            if (response.length > maxLength) {
                return response.substring(0, maxLength) + '...';
            }

            return response;

        } catch (error) {
            console.error('[VoiceCall] Erro ao gerar resposta AI:', error);
            return 'Desculpe, tive uma dificuldade técnica. Pode repetir por favor?';
        }
    }

    async synthesizeSpeech(text) {
        try {
            console.log(`[VoiceCall] Sintetizando fala: "${text.substring(0, 50)}..."`);

            // Criar arquivo temporário
            const tempId = `tts_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            const tempTextFile = join(tmpdir(), `${tempId}.txt`);
            const tempAudioFile = join(tmpdir(), `${tempId}.mp3`);

            // Limpar texto para TTS (remover markdown, etc)
            const cleanText = text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/#{1,6}\s/g, '')
                .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
                .trim();

            // Escrever texto em arquivo temporário (mais seguro que passar como argumento)
            await writeFile(tempTextFile, cleanText, 'utf-8');

            // Construir comando edge-tts usando arquivo de texto
            const command = [
                EDGE_TTS_PATH,
                `--voice ${VOICE_CONFIG.voice}`,
                `--rate ${VOICE_CONFIG.rate}`,
                `--pitch ${VOICE_CONFIG.pitch}`,
                `--file ${tempTextFile}`,
                `--write-media ${tempAudioFile}`
            ].join(' ');

            // Executar TTS
            await execAsync(command, {
                timeout: 30000,
                maxBuffer: 10 * 1024 * 1024
            });

            // Verificar se arquivo foi criado
            if (!existsSync(tempAudioFile)) {
                throw new Error('TTS não gerou o arquivo de áudio');
            }

            // Ler arquivo
            const audioBuffer = await readFile(tempAudioFile);

            // Limpar arquivos temporários
            try {
                await unlink(tempTextFile);
                await unlink(tempAudioFile);
            } catch (err) {
                console.warn('[VoiceCall] Não foi possível limpar arquivos temp:', err.message);
            }

            return audioBuffer;

        } catch (error) {
            console.error('[VoiceCall] Erro ao sintetizar fala:', error);
            return null;
        }
    }

    async end() {
        this.isActive = false;
        const duration = Math.floor((new Date() - this.startTime) / 1000);
        
        console.log(`[VoiceCall] Chamada encerrada: ${this.callId}`);
        console.log(`   Duração: ${duration}s`);
        console.log(`   Mensagens: ${this.conversationHistory.length}`);

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
                conversation: this.conversationHistory
            };

            // Salvar no banco de dados
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
 * Iniciar uma nova chamada de voz
 */
export async function startCall(callId, remoteJid) {
    try {
        console.log(`[VoiceCall] Iniciando chamada: ${callId} com ${remoteJid}`);

        const session = new CallSession(callId, remoteJid);
        await session.initializeAI();
        
        activeCalls.set(callId, session);

        return {
            success: true,
            callId,
            session
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
 * Processar áudio recebido durante uma chamada
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
        messageCount: session.conversationHistory.length,
        isActive: session.isActive
    };
}

/**
 * Listar todas as chamadas ativas
 */
export function getActiveCalls() {
    return Array.from(activeCalls.keys()).map(callId => getCallStatus(callId));
}

/**
 * Verificar se TTS está disponível
 */
export async function checkTTSAvailability() {
    try {
        await execAsync(`${EDGE_TTS_PATH} --version`, { timeout: 5000 });
        return true;
    } catch (error) {
        console.warn('[VoiceCall] edge-tts não disponível:', error.message);
        return false;
    }
}

// Export default
export default {
    startCall,
    processCallAudio,
    endCall,
    getCallStatus,
    getActiveCalls,
    checkTTSAvailability
};
