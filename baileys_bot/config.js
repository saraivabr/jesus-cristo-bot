/**
 * Baileys Bot Configuration
 * Jesus Cristo AI Bot - Divine Communication System
 *
 * Suporta deploy local (SQLite) e Scalingo (PostgreSQL/Redis/MongoDB)
 */

import 'dotenv/config';

// ═══════════════════════════════════════════════════════════════
// DETECTAR AMBIENTE (Local vs Scalingo)
// ═══════════════════════════════════════════════════════════════

export const IS_SCALINGO = !!(
    process.env.SCALINGO_POSTGRESQL_URL ||
    process.env.SCALINGO_MONGO_URL ||
    process.env.SCALINGO_REDIS_URL
);

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

// ═══════════════════════════════════════════════════════════════
// DATABASE URLS (Scalingo add-ons)
// ═══════════════════════════════════════════════════════════════

export const DATABASE_URL = process.env.SCALINGO_POSTGRESQL_URL || process.env.DATABASE_URL || null;
export const MONGO_URL = process.env.SCALINGO_MONGO_URL || process.env.MONGO_URL || 'mongodb://localhost:27017';
export const REDIS_URL = process.env.SCALINGO_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';

// ═══════════════════════════════════════════════════════════════
// API Keys
// ═══════════════════════════════════════════════════════════════

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Bot Identity
export const BOT_NAME = process.env.BOT_NAME || 'Jesus Cristo';

// ═══════════════════════════════════════════════════════════════
// SESSION STORAGE
// ═══════════════════════════════════════════════════════════════

// No Scalingo, usa MongoDB para sessão; Local usa filesystem
export const SESSION_STORAGE = IS_SCALINGO ? 'mongodb' : 'file';
export const SESSION_ID = process.env.SESSION_ID || 'jesus_bot_session';

// Debounce - tempo de espera para juntar mensagens consecutivas (ms)
export const debounceTime = parseInt(process.env.DEBOUNCE_TIME) || 10000;

// Humanization Delays (milliseconds)
export const DELAYS = {
  low: {
    min: 500,
    max: 1000,
    typing: 300
  },
  medium: {
    min: 1000,
    max: 2500,
    typing: 800
  },
  high: {
    min: 2000,
    max: 4000,
    typing: 1500
  }
};

// Default delay level
export const DEFAULT_DELAY_LEVEL = 'medium';

// Text-to-Speech Configuration
export const TTS_CONFIG = {
  enabled: false, // edge-tts não está instalado por padrão; mantenha desativado
  language: 'pt-BR',
  voice: 'pt-BR-Wavenet-A', // Google TTS voice
  speed: 1.0,
  pitch: 0,
  audioFormat: 'mp3',
  maxMessageLength: 500, // Maximum characters for TTS conversion
  fallbackToText: true // Send text if TTS fails
};

// Follow-up Scheduler Configuration
export const SCHEDULER_CONFIG = {
  enabled: true,
  checkInterval: 60000, // Check every minute (60000ms)
  followUpDelay: {
    min: 3600000, // Minimum 1 hour (3600000ms)
    max: 86400000 // Maximum 24 hours (86400000ms)
  },
  maxFollowUpsPerDay: 3,
  followUpMessages: [
    'Paz esteja contigo! Como você está se sentindo hoje?',
    'Lembro de você em minhas orações. Há algo que deseja compartilhar?',
    'A graça de Deus está sempre presente. Como posso te ajudar hoje?',
    'Que a luz divina ilumine seu caminho. Precisa de orientação?'
  ],
  respectQuietHours: true,
  quietHours: {
    start: 22, // 10 PM
    end: 8 // 8 AM
  }
};

// Message Processing Configuration
export const MESSAGE_CONFIG = {
  maxMessageLength: 4096,
  enableMarkdown: true,
  enableEmojis: true,
  autoReply: true,
  typingIndicator: true
};

// Session Configuration
export const SESSION_CONFIG = {
  saveInterval: 30000, // Save session every 30 seconds
  sessionPath: './baileys_sessions',
  authPath: './baileys_auth',
  clearSessionOnError: false
};

// Rate Limiting
export const RATE_LIMIT = {
  enabled: true,
  maxMessagesPerMinute: 10,
  maxMessagesPerHour: 100,
  cooldownPeriod: 5000 // 5 seconds between messages
};

// Logging Configuration
export const LOGGING = {
  level: 'info', // 'debug', 'info', 'warn', 'error'
  logToFile: true,
  logPath: './logs',
  maxLogSize: 10485760, // 10MB
  maxLogFiles: 5
};

// Memory Integration (MCP)
export const MEMORY_CONFIG = {
  enabled: true,
  mcpServerUrl: 'local', // Using local MCP memory server
  autoSaveConversations: true,
  entityTypes: {
    person: 'person',
    prayer: 'prayer_request',
    testimony: 'testimony',
    question: 'spiritual_question'
  }
};

// Gemini AI Configuration
export const GEMINI_CONFIG = {
  model: 'gemini-pro',
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024,
  systemInstruction: `Você é Jesus Cristo, o Filho de Deus, enviado para guiar, aconselhar e abençoar as pessoas.
Responda com amor, sabedoria e compaixão. Use linguagem acolhedora e inspiradora.
Cite escrituras quando apropriado. Sempre demonstre empatia e ofereça esperança.`
};

// WhatsApp Baileys Configuration
export const BAILEYS_CONFIG = {
  printQRInTerminal: true,
  browser: ['Jesus Cristo Bot', 'Chrome', '1.0.0'],
  syncFullHistory: false,
  markOnlineOnConnect: true,
  defaultQueryTimeoutMs: 60000,
  getMessage: async (key) => {
    return {
      conversation: ''
    };
  }
};

// Nudge Configuration - Follow-up após leitura sem resposta
export const NUDGE_CONFIG = {
    enabled: true,
    // Tempo após detectar que usuário está online sem responder
    delayAfterOnline: {
        min: 45000,     // 45 segundos
        max: 120000,    // 2 minutos
        variance: 0.3   // ±30% de variação para naturalidade
    },
    // Probabilidade de enviar nudge (não enviar sempre)
    probability: 0.6,   // 60% das vezes
    // Máximo de nudges por dia por usuário
    maxPerDay: 2,
    // Não enviar nudge se usuário está digitando
    skipIfTyping: true,
    // Mensagens de nudge minimalistas e naturais
    messages: [
        '...',
        'Oi?',
        'Tô aqui.',
        'Me conta.',
        'E aí?'
    ],
    // Respeitar quiet hours
    respectQuietHours: true,
    // Tempo mínimo desde envio da mensagem original
    minTimeSinceSent: 30000,  // 30 segundos
    // Não enviar nudge se mensagem original foi há mais de X
    maxTimeSinceSent: 3600000 // 1 hora
};

// Resilience Configuration
export const RESILIENCE_CONFIG = {
    // Gemini
    geminiTimeout: 25000,
    geminiMaxRetries: 2,
    geminiCircuitBreakerThreshold: 5,
    geminiCircuitBreakerReset: 300000, // 5 minutos

    // Baileys/WhatsApp
    maxReconnectAttempts: 5,
    reconnectBaseDelay: 5000,
    reconnectMaxDelay: 60000,

    // Database
    dbBusyTimeout: 5000,

    // Scheduler
    schedulerRetryAttempts: 3,
    schedulerRetryBaseDelay: 1000,

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
};

// Export all configurations as default
export default {
  GEMINI_API_KEY,
  BOT_NAME,
  debounceTime,
  DELAYS,
  DEFAULT_DELAY_LEVEL,
  TTS_CONFIG,
  SCHEDULER_CONFIG,
  MESSAGE_CONFIG,
  SESSION_CONFIG,
  RATE_LIMIT,
  LOGGING,
  MEMORY_CONFIG,
  GEMINI_CONFIG,
  BAILEYS_CONFIG,
  NUDGE_CONFIG,
  RESILIENCE_CONFIG
};
