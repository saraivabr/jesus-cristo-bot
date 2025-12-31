/**
 * Redis Cache Module for Jesus Pastoral Bot
 * Cache de alta performance para mensagens, rate limiting e dados temporários
 *
 * Variáveis de ambiente:
 * - SCALINGO_REDIS_URL (fornecida automaticamente pelo add-on)
 */

import Redis from 'ioredis';

// Redis connection
const REDIS_URL = process.env.SCALINGO_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';

let redis = null;

/**
 * Conecta ao Redis
 */
function getRedisClient() {
    if (redis && redis.status === 'ready') {
        return redis;
    }

    redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        enableReadyCheck: true,
        // TLS para produção
        tls: process.env.NODE_ENV === 'production' ? {} : undefined,
    });

    redis.on('connect', () => {
        console.log('[Redis] Conectado com sucesso!');
    });

    redis.on('error', (err) => {
        console.error('[Redis] Erro de conexão:', err.message);
    });

    redis.on('close', () => {
        console.log('[Redis] Conexão fechada');
    });

    return redis;
}

// ═══════════════════════════════════════════════════════════════
// CACHE GENÉRICO
// ═══════════════════════════════════════════════════════════════

/**
 * Salva valor no cache com TTL opcional
 * @param {string} key - Chave
 * @param {any} value - Valor (será serializado como JSON)
 * @param {number} ttlSeconds - Tempo de vida em segundos (default: 1 hora)
 */
export async function set(key, value, ttlSeconds = 3600) {
    try {
        const client = getRedisClient();
        const serialized = JSON.stringify(value);

        if (ttlSeconds > 0) {
            await client.setex(key, ttlSeconds, serialized);
        } else {
            await client.set(key, serialized);
        }

        return true;
    } catch (error) {
        console.error(`[Redis] Erro ao salvar ${key}:`, error.message);
        return false;
    }
}

/**
 * Busca valor do cache
 * @param {string} key - Chave
 * @returns {Promise<any>} - Valor ou null
 */
export async function get(key) {
    try {
        const client = getRedisClient();
        const value = await client.get(key);

        if (!value) return null;
        return JSON.parse(value);
    } catch (error) {
        console.error(`[Redis] Erro ao buscar ${key}:`, error.message);
        return null;
    }
}

/**
 * Remove valor do cache
 * @param {string} key - Chave
 */
export async function del(key) {
    try {
        const client = getRedisClient();
        await client.del(key);
        return true;
    } catch (error) {
        console.error(`[Redis] Erro ao deletar ${key}:`, error.message);
        return false;
    }
}

/**
 * Verifica se chave existe
 * @param {string} key - Chave
 */
export async function exists(key) {
    try {
        const client = getRedisClient();
        return await client.exists(key) === 1;
    } catch (error) {
        console.error(`[Redis] Erro ao verificar ${key}:`, error.message);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica e incrementa rate limit
 * @param {string} identifier - Identificador único (ex: telefone)
 * @param {number} maxRequests - Máximo de requisições
 * @param {number} windowSeconds - Janela de tempo em segundos
 * @returns {Promise<{allowed: boolean, remaining: number, resetIn: number}>}
 */
export async function checkRateLimit(identifier, maxRequests = 10, windowSeconds = 60) {
    try {
        const client = getRedisClient();
        const key = `ratelimit:${identifier}`;
        const now = Date.now();
        const windowMs = windowSeconds * 1000;

        // Remove entradas antigas
        await client.zremrangebyscore(key, 0, now - windowMs);

        // Conta entradas atuais
        const count = await client.zcard(key);

        if (count >= maxRequests) {
            // Busca quando o rate limit vai resetar
            const oldest = await client.zrange(key, 0, 0, 'WITHSCORES');
            const resetIn = oldest.length >= 2
                ? Math.ceil((parseInt(oldest[1]) + windowMs - now) / 1000)
                : windowSeconds;

            return {
                allowed: false,
                remaining: 0,
                resetIn
            };
        }

        // Adiciona nova entrada
        await client.zadd(key, now, `${now}-${Math.random()}`);
        await client.expire(key, windowSeconds);

        return {
            allowed: true,
            remaining: maxRequests - count - 1,
            resetIn: windowSeconds
        };
    } catch (error) {
        console.error(`[Redis] Erro no rate limit:`, error.message);
        // Em caso de erro, permite a requisição
        return { allowed: true, remaining: maxRequests, resetIn: windowSeconds };
    }
}

// ═══════════════════════════════════════════════════════════════
// CACHE DE MENSAGENS / DEBOUNCE
// ═══════════════════════════════════════════════════════════════

/**
 * Armazena mensagem no buffer de debounce
 * @param {string} jid - JID do usuário
 * @param {object} messageData - Dados da mensagem
 * @param {number} ttlSeconds - TTL em segundos
 */
export async function pushToMessageBuffer(jid, messageData, ttlSeconds = 30) {
    try {
        const client = getRedisClient();
        const key = `msgbuffer:${jid}`;

        await client.rpush(key, JSON.stringify(messageData));
        await client.expire(key, ttlSeconds);

        return true;
    } catch (error) {
        console.error(`[Redis] Erro ao adicionar ao buffer:`, error.message);
        return false;
    }
}

/**
 * Busca e limpa buffer de mensagens
 * @param {string} jid - JID do usuário
 * @returns {Promise<object[]>} - Lista de mensagens
 */
export async function popMessageBuffer(jid) {
    try {
        const client = getRedisClient();
        const key = `msgbuffer:${jid}`;

        // Busca todas as mensagens
        const messages = await client.lrange(key, 0, -1);

        // Limpa o buffer
        await client.del(key);

        return messages.map(m => JSON.parse(m));
    } catch (error) {
        console.error(`[Redis] Erro ao buscar buffer:`, error.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// CACHE DE CONTEXTO / CONVERSA
// ═══════════════════════════════════════════════════════════════

/**
 * Cache de contexto de conversa para Gemini
 * Evita recarregar do banco a cada mensagem
 *
 * @param {string} jid - JID do usuário
 * @param {object} context - Contexto da conversa
 * @param {number} ttlSeconds - TTL (default: 5 minutos)
 */
export async function cacheContext(jid, context, ttlSeconds = 300) {
    return set(`context:${jid}`, context, ttlSeconds);
}

/**
 * Busca contexto do cache
 * @param {string} jid - JID do usuário
 */
export async function getCachedContext(jid) {
    return get(`context:${jid}`);
}

/**
 * Invalida cache de contexto
 * @param {string} jid - JID do usuário
 */
export async function invalidateContext(jid) {
    return del(`context:${jid}`);
}

// ═══════════════════════════════════════════════════════════════
// PRESENCE TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Salva estado de presença do usuário
 * @param {string} jid - JID do usuário
 * @param {object} presence - Dados de presença
 */
export async function setUserPresence(jid, presence) {
    return set(`presence:${jid}`, presence, 60); // 1 minuto TTL
}

/**
 * Busca presença do usuário
 * @param {string} jid - JID do usuário
 */
export async function getUserPresence(jid) {
    return get(`presence:${jid}`);
}

// ═══════════════════════════════════════════════════════════════
// NUDGE TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Registra nudge pendente
 * @param {string} jid - JID do usuário
 * @param {object} nudgeData - Dados do nudge
 * @param {number} ttlSeconds - TTL
 */
export async function setNudgePending(jid, nudgeData, ttlSeconds = 3600) {
    return set(`nudge:${jid}`, nudgeData, ttlSeconds);
}

/**
 * Busca nudge pendente
 * @param {string} jid - JID do usuário
 */
export async function getNudgePending(jid) {
    return get(`nudge:${jid}`);
}

/**
 * Remove nudge pendente
 * @param {string} jid - JID do usuário
 */
export async function clearNudge(jid) {
    return del(`nudge:${jid}`);
}

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

/**
 * Health check do Redis
 */
export async function healthCheck() {
    try {
        const client = getRedisClient();
        const pong = await client.ping();
        return { status: 'ok', ping: pong };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
}

/**
 * Fecha conexão com Redis
 */
export async function closeConnection() {
    if (redis) {
        await redis.quit();
        redis = null;
        console.log('[Redis] Conexão fechada');
    }
}

/**
 * Limpa todo o cache (use com cuidado!)
 */
export async function flushAll() {
    try {
        const client = getRedisClient();
        await client.flushdb();
        console.log('[Redis] Cache limpo');
        return true;
    } catch (error) {
        console.error('[Redis] Erro ao limpar cache:', error.message);
        return false;
    }
}

/**
 * Estatísticas do Redis
 */
export async function getStats() {
    try {
        const client = getRedisClient();
        const info = await client.info('memory');
        const dbSize = await client.dbsize();

        return {
            keys: dbSize,
            memoryInfo: info
        };
    } catch (error) {
        console.error('[Redis] Erro ao buscar stats:', error.message);
        return null;
    }
}

// Export default
export default {
    set,
    get,
    del,
    exists,
    checkRateLimit,
    pushToMessageBuffer,
    popMessageBuffer,
    cacheContext,
    getCachedContext,
    invalidateContext,
    setUserPresence,
    getUserPresence,
    setNudgePending,
    getNudgePending,
    clearNudge,
    healthCheck,
    closeConnection,
    flushAll,
    getStats
};
