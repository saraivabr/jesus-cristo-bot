/**
 * Audio Processor Module
 * Jesus Cristo Bot - Processamento Completo de Audio
 *
 * Features:
 * - Transcrição de áudio recebido (Gemini ou fallback)
 * - Geração de áudio de bênção (edge-tts)
 * - Detecção inteligente de momentos para áudio
 * - Processamento de mensagens de áudio do WhatsApp
 * - Áudios pré-gravados para momentos especiais
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir, access } from 'fs/promises';
import { existsSync, mkdirSync, constants } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import config, { TTS_CONFIG } from './config.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// CONFIGURACAO
// ═══════════════════════════════════════════════════════════════

// Gemini para transcrição de áudio (novo SDK)
const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

// Path do edge-tts
const EDGE_TTS_PATH = '/opt/homebrew/bin/edge-tts';

// Diretório temporário para áudios
const tempDir = join(__dirname, 'temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

// Diretório de áudios pré-gravados
const PRERECORDED_DIR = join(__dirname, 'audios');

// Diretório de cache para áudios gerados
const AUDIO_CACHE_DIR = join(__dirname, '.audio_cache');

// Vozes disponíveis para diferentes momentos
const VOICES = {
  blessing: 'pt-BR-AntonioNeural',      // Masculina, serena para bênçãos
  prayer: 'pt-BR-AntonioNeural',        // Masculina, reverente para orações
  comfort: 'pt-BR-FranciscaNeural',     // Feminina, acolhedora para conforto
  teaching: 'pt-BR-AntonioNeural',      // Masculina, didática para ensinos
  welcome: 'pt-BR-AntonioNeural',       // Masculina, calorosa para boas-vindas
  urgent: 'pt-BR-AntonioNeural',        // Masculina, firme para urgências
};

// Tipos de áudios pré-gravados
const PRERECORDED_TYPES = {
  'boas-vindas': 'boasvindas.mp3',
  'bencao-matinal': 'bencao_matinal.mp3',
  'bencao-noturna': 'bencao_noturna.mp3',
  'oracao-cura': 'oracao_cura.mp3',
  'oracao-paz': 'oracao_paz.mp3',
  'salmo-23': 'salmo23.mp3',
  'pai-nosso': 'pai_nosso.mp3',
};

// Cache em memória para áudios comuns (evita regenerar)
const audioCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// ═══════════════════════════════════════════════════════════════
// 1. TRANSCRIÇÃO DE AUDIO RECEBIDO
// ═══════════════════════════════════════════════════════════════

/**
 * Transcreve áudio usando Gemini (que suporta áudio nativamente)
 *
 * @param {Buffer} audioBuffer - Buffer do arquivo de áudio
 * @param {string} mimeType - Tipo MIME do áudio (ex: 'audio/ogg', 'audio/mpeg')
 * @returns {Promise<string|null>} Texto transcrito
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg') {
  if (!audioBuffer || audioBuffer.length === 0) {
    console.warn('[AudioProcessor] Buffer de áudio vazio');
    return null;
  }

  try {
    console.log(`[AudioProcessor] Transcrevendo áudio (${audioBuffer.length} bytes, ${mimeType})`);

    // Converte buffer para base64
    const audioBase64 = audioBuffer.toString('base64');

    // Novo SDK: usa ai.models.generateContent com inline data
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBase64
          }
        },
        {
          text: `Transcreva este áudio em português brasileiro.
Retorne APENAS o texto falado, sem explicações, timestamps ou formatação extra.
Se não conseguir entender, retorne "[áudio inaudível]".
Se estiver em silêncio, retorne "[silêncio]".`
        }
      ]
    });

    const transcription = result.text.trim();

    console.log(`[AudioProcessor] Transcrição: "${transcription.substring(0, 100)}..."`);
    return transcription;

  } catch (error) {
    console.error('[AudioProcessor] Erro na transcrição Gemini:', error.message);

    // Fallback: tenta com Whisper se disponível
    return await transcribeWithWhisperFallback(audioBuffer, mimeType);
  }
}

/**
 * Fallback de transcrição usando Whisper (se instalado localmente)
 *
 * @param {Buffer} audioBuffer - Buffer do áudio
 * @param {string} mimeType - Tipo MIME
 * @returns {Promise<string|null>} Texto transcrito ou null
 */
async function transcribeWithWhisperFallback(audioBuffer, mimeType) {
  try {
    // Verifica se whisper está instalado
    await execAsync('which whisper');
  } catch {
    console.warn('[AudioProcessor] Whisper não encontrado, transcrição falhou');
    return null;
  }

  const tempId = `whisper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const extension = mimeType.includes('ogg') ? 'ogg' :
                    mimeType.includes('mpeg') ? 'mp3' :
                    mimeType.includes('wav') ? 'wav' : 'ogg';
  const tempAudioFile = join(tmpdir(), `${tempId}.${extension}`);
  const tempOutputFile = join(tmpdir(), `${tempId}.txt`);

  try {
    await writeFile(tempAudioFile, audioBuffer);

    // Executa Whisper
    await execAsync(
      `whisper "${tempAudioFile}" --language pt --model tiny --output_format txt --output_dir "${tmpdir()}"`,
      { timeout: 60000 }
    );

    // Lê resultado
    const transcription = await readFile(tempOutputFile, 'utf-8');

    // Limpa arquivos temp
    await cleanupFiles([tempAudioFile, tempOutputFile]);

    return transcription.trim();

  } catch (error) {
    console.error('[AudioProcessor] Fallback Whisper falhou:', error.message);
    await cleanupFiles([tempAudioFile, tempOutputFile]);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. GERACAO DE AUDIO DE BENCAO
// ═══════════════════════════════════════════════════════════════

/**
 * Gera áudio de bênção/oração usando edge-tts
 *
 * @param {string} text - Texto a ser convertido
 * @param {string} voiceType - Tipo de voz ('blessing', 'prayer', 'comfort', 'teaching', 'welcome', 'urgent')
 * @returns {Promise<Buffer|null>} Buffer do áudio MP3 ou null se falhar
 */
export async function generateBlessingAudio(text, voiceType = 'blessing') {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.warn('[AudioProcessor] Texto inválido para gerar áudio');
    return null;
  }

  // Limita tamanho do texto
  const trimmedText = text.slice(0, TTS_CONFIG.maxMessageLength || 500);

  // Verifica cache primeiro
  const cacheKey = `${voiceType}:${trimmedText}`;
  const cached = audioCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[AudioProcessor] Retornando áudio do cache');
    return cached.buffer;
  }

  // Verifica se edge-tts está disponível
  if (!await isEdgeTTSAvailable()) {
    console.warn('[AudioProcessor] edge-tts não disponível');
    return null;
  }

  const voice = VOICES[voiceType] || VOICES.blessing;
  const tempId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const tempAudioFile = join(tmpdir(), `${tempId}.mp3`);

  try {
    // Prepara texto (escapa aspas)
    const safeText = trimmedText.replace(/"/g, '\\"').replace(/\n/g, ' ');

    // Configura velocidade e pitch baseado no tipo
    const speedConfig = {
      blessing: { rate: '-5%', pitch: '-2Hz' },
      prayer: { rate: '-10%', pitch: '-3Hz' },
      comfort: { rate: '-5%', pitch: '+1Hz' },
      teaching: { rate: '+0%', pitch: '+0Hz' },
      welcome: { rate: '+0%', pitch: '+1Hz' },
      urgent: { rate: '+5%', pitch: '+2Hz' },
    };

    const voiceConfig = speedConfig[voiceType] || speedConfig.blessing;

    // Monta comando edge-tts
    const command = [
      EDGE_TTS_PATH,
      `--voice "${voice}"`,
      `--text "${safeText}"`,
      `--write-media "${tempAudioFile}"`,
      `--rate="${voiceConfig.rate}"`,
      `--pitch="${voiceConfig.pitch}"`
    ].join(' ');

    console.log(`[AudioProcessor] Gerando áudio com voz ${voice}...`);

    await execAsync(command, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024
    });

    // Verifica se arquivo foi criado
    if (!existsSync(tempAudioFile)) {
      throw new Error('Arquivo de áudio não foi gerado');
    }

    // Lê o áudio
    const audioBuffer = await readFile(tempAudioFile);

    // Adiciona ao cache
    audioCache.set(cacheKey, {
      buffer: audioBuffer,
      timestamp: Date.now()
    });

    // Limpa arquivo temporário
    await cleanupFiles([tempAudioFile]);

    console.log(`[AudioProcessor] Áudio gerado com sucesso (${audioBuffer.length} bytes)`);
    return audioBuffer;

  } catch (error) {
    console.error('[AudioProcessor] Erro ao gerar áudio:', error.message);
    await cleanupFiles([tempAudioFile]);
    return null;
  }
}

/**
 * Gera áudio com fallback para texto
 *
 * @param {string} text - Texto a converter
 * @param {string} voiceType - Tipo de voz
 * @returns {Promise<{audio: Buffer|null, fallbackToText: boolean}>}
 */
export async function generateAudioWithFallback(text, voiceType = 'blessing') {
  try {
    const audio = await generateBlessingAudio(text, voiceType);
    return {
      audio,
      fallbackToText: audio === null
    };
  } catch (error) {
    console.error('[AudioProcessor] Erro com fallback:', error.message);
    return {
      audio: null,
      fallbackToText: true
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. DETECCAO DE MOMENTO PARA AUDIO
// ═══════════════════════════════════════════════════════════════

/**
 * Gatilhos emocionais que indicam necessidade de áudio
 */
const AUDIO_TRIGGERS = {
  prayer: [
    'ore por mim', 'oração', 'preciso de oração', 'ore comigo',
    'reza por mim', 'intercede', 'ora por', 'orando'
  ],
  blessing: [
    'me abençoe', 'abençoa', 'bênção', 'benção', 'abençoar',
    'sua bênção', 'quer me abençoar'
  ],
  emotional_intense: [
    'não aguento mais', 'quero morrer', 'desisto', 'desespero',
    'chorando muito', 'dor muito forte', 'não suporto', 'me ajuda',
    'socorro', 'preciso de você', 'estou perdido', 'não sei o que fazer'
  ],
  long_confession: [
    'preciso desabafar', 'desabafo', 'confessar', 'preciso falar',
    'escuta', 'me ouve', 'deixa eu contar'
  ],
  gratitude_intense: [
    'muito obrigado', 'gratidão eterna', 'não tenho palavras',
    'mudou minha vida', 'salvou minha vida', 'milagre'
  ]
};

/**
 * Moods que merecem resposta em áudio
 */
const AUDIO_WORTHY_MOODS = [
  'desesperado',
  'triste',
  'ansioso',
  'grato',
  'emocionado'
];

/**
 * Determina se deve enviar áudio baseado no mood e contexto
 *
 * @param {string} mood - Estado emocional detectado ('triste', 'ansioso', 'feliz', 'desesperado', 'neutro')
 * @param {Object} context - Contexto adicional
 * @param {string} context.userMessage - Mensagem do usuário
 * @param {string} context.responseText - Texto da resposta gerada
 * @param {number} context.messageCount - Quantidade de mensagens na conversa
 * @param {number} context.messageLength - Tamanho da mensagem do usuário
 * @param {boolean} context.isFirstContact - Se é primeiro contato
 * @returns {{shouldSend: boolean, voiceType: string, reason: string}}
 */
export function shouldSendAudio(mood, context = {}) {
  const {
    userMessage = '',
    responseText = '',
    messageCount = 0,
    messageLength = 0,
    isFirstContact = false
  } = context;

  const lowerMessage = userMessage.toLowerCase();
  const lowerResponse = responseText.toLowerCase();

  // 1. Pedido explícito de oração
  if (AUDIO_TRIGGERS.prayer.some(trigger => lowerMessage.includes(trigger))) {
    return {
      shouldSend: true,
      voiceType: 'prayer',
      reason: 'Pedido de oração detectado'
    };
  }

  // 2. Pedido de bênção
  if (AUDIO_TRIGGERS.blessing.some(trigger => lowerMessage.includes(trigger))) {
    return {
      shouldSend: true,
      voiceType: 'blessing',
      reason: 'Pedido de bênção detectado'
    };
  }

  // 3. Momento emocional intenso (desespero, crise)
  if (AUDIO_TRIGGERS.emotional_intense.some(trigger => lowerMessage.includes(trigger))) {
    return {
      shouldSend: true,
      voiceType: 'comfort',
      reason: 'Momento emocional intenso detectado'
    };
  }

  // 4. Mood de desespero ou tristeza profunda
  if (mood === 'desesperado') {
    return {
      shouldSend: true,
      voiceType: 'comfort',
      reason: 'Humor desesperado detectado'
    };
  }

  // 5. Desabafo longo (mensagem > 500 caracteres)
  if (messageLength > 500 && AUDIO_TRIGGERS.long_confession.some(t => lowerMessage.includes(t))) {
    return {
      shouldSend: true,
      voiceType: 'comfort',
      reason: 'Desabafo longo detectado'
    };
  }

  // 6. Gratidão intensa
  if (AUDIO_TRIGGERS.gratitude_intense.some(trigger => lowerMessage.includes(trigger))) {
    return {
      shouldSend: true,
      voiceType: 'blessing',
      reason: 'Gratidão intensa detectada'
    };
  }

  // 7. Resposta contém oração/bênção (detecta no texto gerado)
  const responseHasPrayer = /senhor[,.]|pai[,.]|amém|em nome de jesus/i.test(lowerResponse);
  const responseHasBlessing = /abençoo|te abençoo|paz esteja|que deus|derramando/i.test(lowerResponse);

  if (responseHasPrayer && mood !== 'neutro') {
    return {
      shouldSend: Math.random() < 0.4, // 40% de chance
      voiceType: 'prayer',
      reason: 'Resposta contém oração e momento propício'
    };
  }

  if (responseHasBlessing) {
    return {
      shouldSend: Math.random() < 0.3, // 30% de chance
      voiceType: 'blessing',
      reason: 'Resposta contém bênção'
    };
  }

  // 8. Primeiro contato + mood adequado (boas-vindas especial)
  if (isFirstContact && messageCount <= 1) {
    return {
      shouldSend: Math.random() < 0.2, // 20% de chance
      voiceType: 'welcome',
      reason: 'Primeiro contato'
    };
  }

  // Default: não enviar áudio
  return {
    shouldSend: false,
    voiceType: 'blessing',
    reason: 'Momento não requer áudio'
  };
}

// ═══════════════════════════════════════════════════════════════
// 4. PROCESSAMENTO DE AUDIO RECEBIDO
// ═══════════════════════════════════════════════════════════════

/**
 * Processa mensagem de áudio recebida do WhatsApp
 * Baixa, transcreve e retorna o texto
 *
 * @param {Object} audioMessage - Objeto de mensagem de áudio do Baileys
 * @param {Object} sock - Socket do Baileys para download
 * @returns {Promise<{success: boolean, text: string|null, duration: number, buffer: Buffer|null, error: string|null}>}
 */
export async function processIncomingAudio(audioMessage, sock) {
  const result = {
    success: false,
    text: null,
    duration: 0,
    buffer: null,
    error: null
  };

  try {
    if (!audioMessage) {
      result.error = 'Mensagem de áudio inválida';
      return result;
    }

    // Extrai informações do áudio
    const audioInfo = audioMessage.message?.audioMessage || audioMessage.message?.pttMessage;
    if (!audioInfo) {
      result.error = 'Formato de áudio não reconhecido';
      return result;
    }

    result.duration = audioInfo.seconds || 0;
    const mimeType = audioInfo.mimetype || 'audio/ogg; codecs=opus';

    console.log(`[AudioProcessor] Processando áudio: ${result.duration}s, ${mimeType}`);

    // Baixa o áudio
    let audioBuffer;
    try {
      audioBuffer = await downloadMediaMessage(
        audioMessage,
        'buffer',
        {},
        {
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      );
    } catch (downloadError) {
      console.error('[AudioProcessor] Erro ao baixar áudio:', downloadError.message);
      result.error = 'Falha ao baixar áudio';
      return result;
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      result.error = 'Áudio baixado está vazio';
      return result;
    }

    result.buffer = audioBuffer;
    console.log(`[AudioProcessor] Áudio baixado: ${audioBuffer.length} bytes`);

    // Transcreve o áudio
    const transcription = await transcribeAudio(audioBuffer, mimeType.split(';')[0]);

    if (!transcription) {
      result.error = 'Não foi possível transcrever o áudio';
      // Retorna sucesso parcial - indica que recebeu áudio mas não entendeu
      result.success = true;
      result.text = '[ÁUDIO recebido mas não foi possível transcrever]';
      return result;
    }

    result.success = true;
    result.text = transcription;

    console.log(`[AudioProcessor] Transcrição completa: "${transcription.substring(0, 100)}..."`);
    return result;

  } catch (error) {
    console.error('[AudioProcessor] Erro no processamento:', error);
    result.error = error.message;
    return result;
  }
}

/**
 * Versão simplificada para compatibilidade com código existente
 * @param {Object} message - Mensagem do Baileys contendo audio
 * @param {Object} sock - Socket do Baileys para download
 * @returns {Promise<{text: string|null, buffer: Buffer|null}>}
 */
export async function processAudioMessage(message, sock) {
  const result = await processIncomingAudio(message, sock);
  return {
    text: result.text,
    buffer: result.buffer
  };
}

// ═══════════════════════════════════════════════════════════════
// 5. AUDIOS PRE-GRAVADOS
// ═══════════════════════════════════════════════════════════════

/**
 * Inicializa diretório de áudios pré-gravados
 */
async function ensurePrerecordedDir() {
  try {
    await access(PRERECORDED_DIR, constants.R_OK);
  } catch {
    try {
      await mkdir(PRERECORDED_DIR, { recursive: true });
      console.log(`[AudioProcessor] Diretório de áudios criado: ${PRERECORDED_DIR}`);
    } catch (mkdirError) {
      console.warn('[AudioProcessor] Não foi possível criar diretório de áudios:', mkdirError.message);
    }
  }
}

/**
 * Obtém áudio pré-gravado por tipo
 *
 * @param {string} type - Tipo do áudio ('boas-vindas', 'bencao-matinal', 'bencao-noturna', 'oracao-cura', 'oracao-paz', 'salmo-23', 'pai-nosso')
 * @returns {Promise<Buffer|null>} Buffer do áudio ou null se não encontrado
 */
export async function getPrerecordedAudio(type) {
  await ensurePrerecordedDir();

  const filename = PRERECORDED_TYPES[type];
  if (!filename) {
    console.warn(`[AudioProcessor] Tipo de áudio pré-gravado desconhecido: ${type}`);
    return null;
  }

  const filePath = join(PRERECORDED_DIR, filename);

  try {
    await access(filePath, constants.R_OK);
    const audioBuffer = await readFile(filePath);
    console.log(`[AudioProcessor] Áudio pré-gravado carregado: ${type} (${audioBuffer.length} bytes)`);
    return audioBuffer;
  } catch {
    console.warn(`[AudioProcessor] Áudio pré-gravado não encontrado: ${filePath}`);
    return null;
  }
}

/**
 * Lista todos os áudios pré-gravados disponíveis
 *
 * @returns {Promise<string[]>} Lista de tipos disponíveis
 */
export async function listPrerecordedAudios() {
  await ensurePrerecordedDir();

  const available = [];
  for (const [type, filename] of Object.entries(PRERECORDED_TYPES)) {
    const filePath = join(PRERECORDED_DIR, filename);
    try {
      await access(filePath, constants.R_OK);
      available.push(type);
    } catch {
      // Arquivo não existe, não adiciona
    }
  }

  return available;
}

/**
 * Obtém áudio apropriado para o momento (pré-gravado ou gera novo)
 *
 * @param {string} type - Tipo desejado
 * @param {string} fallbackText - Texto para gerar se pré-gravado não existir
 * @param {string} voiceType - Tipo de voz para geração
 * @returns {Promise<Buffer|null>}
 */
export async function getAudioForMoment(type, fallbackText = null, voiceType = 'blessing') {
  // Tenta pré-gravado primeiro
  const prerecorded = await getPrerecordedAudio(type);
  if (prerecorded) {
    return prerecorded;
  }

  // Se tem texto fallback, gera novo
  if (fallbackText) {
    return await generateBlessingAudio(fallbackText, voiceType);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// UTILITARIOS
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica se edge-tts está disponível
 * @returns {Promise<boolean>}
 */
async function isEdgeTTSAvailable() {
  try {
    await execAsync(`${EDGE_TTS_PATH} --version`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Limpa arquivos temporários
 * @param {string[]} filePaths - Caminhos dos arquivos a limpar
 */
async function cleanupFiles(filePaths) {
  for (const filePath of filePaths) {
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch {
      // Ignora erros de limpeza
    }
  }
}

/**
 * Limpa cache de áudios antigos
 * @returns {number} Quantidade de itens removidos
 */
export function cleanAudioCache() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of audioCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      audioCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[AudioProcessor] Cache limpo: ${cleaned} itens removidos`);
  }

  return cleaned;
}

/**
 * Obtém estatísticas do cache
 * @returns {{size: number, ttlHours: number}}
 */
export function getCacheStats() {
  return {
    size: audioCache.size,
    ttlHours: CACHE_TTL / (60 * 60 * 1000)
  };
}

/**
 * Verifica se uma mensagem contém áudio
 * @param {Object} msgContent - Conteudo da mensagem
 * @returns {boolean}
 */
export function isAudioMessage(msgContent) {
  if (!msgContent) return false;
  return !!(msgContent.audioMessage || msgContent.pttMessage);
}

/**
 * Extrai informações do áudio (duração, etc)
 * @param {Object} audioMessage - Objeto audioMessage do Baileys
 * @returns {{duration: number, ptt: boolean, mimetype: string, fileLength: number}}
 */
export function getAudioInfo(audioMessage) {
  if (!audioMessage) return { duration: 0, ptt: false, mimetype: 'audio/ogg', fileLength: 0 };

  return {
    duration: audioMessage.seconds || 0,
    ptt: audioMessage.ptt || false,
    mimetype: audioMessage.mimetype || 'audio/ogg',
    fileLength: audioMessage.fileLength || 0
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export {
  VOICES,
  PRERECORDED_TYPES,
  AUDIO_TRIGGERS,
  AUDIO_WORTHY_MOODS
};

export default {
  // Transcrição
  transcribeAudio,

  // Geração
  generateBlessingAudio,
  generateAudioWithFallback,

  // Detecção
  shouldSendAudio,

  // Processamento
  processIncomingAudio,
  processAudioMessage,
  isAudioMessage,
  getAudioInfo,

  // Pré-gravados
  getPrerecordedAudio,
  listPrerecordedAudios,
  getAudioForMoment,

  // Utilitários
  cleanAudioCache,
  getCacheStats,

  // Constantes
  VOICES,
  PRERECORDED_TYPES,
  AUDIO_TRIGGERS,
  AUDIO_WORTHY_MOODS
};
