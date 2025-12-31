/**
 * PostgreSQL Database Module for Jesus Pastoral Bot
 * Substitui o SQLite para deploy no Scalingo
 *
 * Variáveis de ambiente do Scalingo:
 * - SCALINGO_POSTGRESQL_URL (fornecida automaticamente pelo add-on)
 */

import pg from 'pg';
const { Pool } = pg;

// Parse da URL do PostgreSQL do Scalingo
const DATABASE_URL = process.env.SCALINGO_POSTGRESQL_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('[Database] SCALINGO_POSTGRESQL_URL não configurada!');
    console.error('[Database] Configure a variável de ambiente ou adicione o add-on PostgreSQL no Scalingo.');
}

// Pool de conexões PostgreSQL
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10, // máximo de conexões no pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Log de conexão
pool.on('connect', () => {
    console.log('[Database] Nova conexão PostgreSQL estabelecida');
});

pool.on('error', (err) => {
    console.error('[Database] Erro inesperado no pool:', err.message);
});

/**
 * Inicializa o banco de dados - cria tabelas se não existirem
 */
async function initDatabase() {
    const client = await pool.connect();
    try {
        // Tabela de usuários
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                telefone TEXT UNIQUE NOT NULL,
                nome TEXT,
                familia JSONB DEFAULT '{}',
                trabalho JSONB DEFAULT '{}',
                jornada_espiritual JSONB DEFAULT '{}',
                ultimo_contato TIMESTAMP WITH TIME ZONE,
                proximo_followup TIMESTAMP WITH TIME ZONE,
                horario_preferido INTEGER,
                nivel TEXT DEFAULT 'curioso',
                ensinos_recentes JSONB DEFAULT '[]',
                ultimo_ensino_index INTEGER DEFAULT 0,
                desafios_realizados JSONB DEFAULT '[]',
                video_boasvindas_enviado BOOLEAN DEFAULT FALSE,
                criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de conversas
        await client.query(`
            CREATE TABLE IF NOT EXISTS conversas (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                mensagem TEXT NOT NULL,
                resposta TEXT,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de agendamentos
        await client.query(`
            CREATE TABLE IF NOT EXISTS agendamentos (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                tipo TEXT NOT NULL,
                data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
                mensagem TEXT NOT NULL,
                enviado BOOLEAN DEFAULT FALSE
            )
        `);

        // Tabela de mensagens enviadas para tracking de nudge
        await client.query(`
            CREATE TABLE IF NOT EXISTS mensagens_enviadas (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                message_key TEXT,
                jid TEXT NOT NULL,
                conteudo TEXT,
                enviado_em TIMESTAMP WITH TIME ZONE NOT NULL,
                entregue_em TIMESTAMP WITH TIME ZONE,
                lido_em TIMESTAMP WITH TIME ZONE,
                respondido BOOLEAN DEFAULT FALSE,
                nudge_enviado BOOLEAN DEFAULT FALSE,
                criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de métricas de engajamento
        await client.query(`
            CREATE TABLE IF NOT EXISTS metricas_engajamento (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                data DATE NOT NULL,
                mensagens_enviadas INTEGER DEFAULT 0,
                mensagens_lidas INTEGER DEFAULT 0,
                respostas_recebidas INTEGER DEFAULT 0,
                nudges_enviados INTEGER DEFAULT 0,
                nudges_respondidos INTEGER DEFAULT 0,
                tempo_medio_resposta INTEGER,
                UNIQUE(usuario_id, data)
            )
        `);

        // Indexes para performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_usuarios_telefone ON usuarios(telefone);
            CREATE INDEX IF NOT EXISTS idx_conversas_usuario_id ON conversas(usuario_id);
            CREATE INDEX IF NOT EXISTS idx_conversas_timestamp ON conversas(timestamp);
            CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_id ON agendamentos(usuario_id);
            CREATE INDEX IF NOT EXISTS idx_agendamentos_data_hora ON agendamentos(data_hora);
            CREATE INDEX IF NOT EXISTS idx_agendamentos_enviado ON agendamentos(enviado);
            CREATE INDEX IF NOT EXISTS idx_mensagens_jid ON mensagens_enviadas(jid);
            CREATE INDEX IF NOT EXISTS idx_mensagens_respondido ON mensagens_enviadas(respondido);
            CREATE INDEX IF NOT EXISTS idx_mensagens_nudge ON mensagens_enviadas(nudge_enviado);
        `);

        console.log('[Database] PostgreSQL inicializado com sucesso!');
    } catch (error) {
        console.error('[Database] Erro ao inicializar:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Safe wrapper for database queries
 */
async function safeQuery(fn, fallback = null, errorMsg = 'Database error') {
    try {
        return await fn();
    } catch (error) {
        console.error(`[Database] ${errorMsg}:`, error.message);
        return fallback;
    }
}

/**
 * Safe JSON parse helper (JSONB já retorna objeto no pg)
 */
function ensureObject(value, fallback = {}) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function ensureArray(value, fallback = []) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return fallback;
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Get user by phone number
 */
export async function getUsuario(telefone) {
    return safeQuery(async () => {
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE telefone = $1',
            [telefone]
        );

        if (result.rows.length === 0) return null;

        const usuario = result.rows[0];
        // JSONB já retorna como objeto no pg
        usuario.familia = ensureObject(usuario.familia, {});
        usuario.trabalho = ensureObject(usuario.trabalho, {});
        usuario.jornada_espiritual = ensureObject(usuario.jornada_espiritual, {});
        usuario.ensinos_recentes = ensureArray(usuario.ensinos_recentes, []);
        usuario.desafios_realizados = ensureArray(usuario.desafios_realizados, []);

        return usuario;
    }, null, `Erro ao buscar usuário: ${telefone}`);
}

/**
 * Save a new user
 */
export async function saveUsuario(userData) {
    return safeQuery(async () => {
        const {
            telefone,
            nome = null,
            familia = {},
            trabalho = {},
            jornada_espiritual = {},
            horario_preferido = null
        } = userData;

        await pool.query(`
            INSERT INTO usuarios (
                telefone, nome, familia, trabalho, jornada_espiritual,
                horario_preferido, ultimo_contato
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
            telefone,
            nome,
            JSON.stringify(familia),
            JSON.stringify(trabalho),
            JSON.stringify(jornada_espiritual),
            horario_preferido
        ]);

        return getUsuario(telefone);
    }, null, `Erro ao salvar usuário: ${userData?.telefone}`);
}

/**
 * Update existing user
 */
export async function updateUsuario(telefone, updates) {
    return safeQuery(async () => {
        const usuario = await getUsuario(telefone);
        if (!usuario) {
            console.error(`[Database] Usuario não encontrado para update: ${telefone}`);
            return null;
        }

        const allowedFields = [
            'nome', 'familia', 'trabalho', 'jornada_espiritual',
            'proximo_followup', 'horario_preferido', 'ensinos_recentes',
            'ultimo_ensino_index', 'nivel', 'desafios_realizados',
            'video_boasvindas_enviado'
        ];

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClauses.push(`${key} = $${paramIndex}`);

                // JSONB fields need to be stringified
                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
                paramIndex++;
            }
        }

        // Always update ultimo_contato
        setClauses.push(`ultimo_contato = CURRENT_TIMESTAMP`);

        if (setClauses.length > 0) {
            values.push(telefone);
            const sql = `UPDATE usuarios SET ${setClauses.join(', ')} WHERE telefone = $${paramIndex}`;
            await pool.query(sql, values);
        }

        return getUsuario(telefone);
    }, null, `Erro ao atualizar usuário: ${telefone}`);
}

/**
 * Add a conversation entry
 */
export async function addConversa(usuarioId, mensagem, resposta = null) {
    return safeQuery(async () => {
        if (!usuarioId) {
            console.warn('[Database] addConversa: usuarioId inválido');
            return null;
        }

        const safeMensagem = typeof mensagem === 'string' ? mensagem : String(mensagem || '');
        const safeResposta = resposta ? (typeof resposta === 'string' ? resposta : String(resposta)) : null;

        const result = await pool.query(`
            INSERT INTO conversas (usuario_id, mensagem, resposta)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [usuarioId, safeMensagem, safeResposta]);

        return result.rows[0];
    }, null, `Erro ao adicionar conversa para usuário: ${usuarioId}`);
}

/**
 * Get conversation history for a user
 */
export async function getHistorico(usuarioId, limit = 50) {
    return safeQuery(async () => {
        if (!usuarioId) return [];

        const result = await pool.query(`
            SELECT * FROM conversas
            WHERE usuario_id = $1
            ORDER BY timestamp DESC
            LIMIT $2
        `, [usuarioId, limit]);

        // Return in chronological order (oldest first)
        return result.rows.reverse();
    }, [], `Erro ao buscar histórico do usuário: ${usuarioId}`);
}

/**
 * Add a scheduled message
 */
export async function addAgendamento({ usuarioId, tipo, dataHora, mensagem }) {
    const result = await pool.query(`
        INSERT INTO agendamentos (usuario_id, tipo, data_hora, mensagem)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [usuarioId, tipo, dataHora, mensagem]);

    return result.rows[0];
}

/**
 * Get pending scheduled messages
 */
export async function getAgendamentosPendentes(beforeTime = null) {
    return safeQuery(async () => {
        const cutoff = beforeTime ? new Date(beforeTime) : new Date();

        if (isNaN(cutoff.getTime())) {
            console.warn('[Database] getAgendamentosPendentes: cutoff inválido');
            return [];
        }

        const result = await pool.query(`
            SELECT a.*, u.telefone, u.nome
            FROM agendamentos a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE a.enviado = FALSE AND a.data_hora <= $1
            ORDER BY a.data_hora ASC
        `, [cutoff]);

        return result.rows;
    }, [], 'Erro ao buscar agendamentos pendentes');
}

/**
 * Mark a scheduled message as sent
 */
export async function marcarAgendamentoEnviado(agendamentoId) {
    const result = await pool.query(`
        UPDATE agendamentos
        SET enviado = TRUE
        WHERE id = $1
    `, [agendamentoId]);

    return { changes: result.rowCount };
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES PARA MENSAGENS ENVIADAS (TRACKING DE NUDGE)
// ═══════════════════════════════════════════════════════════════

/**
 * Registra uma mensagem enviada para tracking
 */
export async function addMensagemEnviada({ usuarioId, messageKey, jid, conteudo }) {
    return safeQuery(async () => {
        const result = await pool.query(`
            INSERT INTO mensagens_enviadas (usuario_id, message_key, jid, conteudo, enviado_em)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING id
        `, [usuarioId, messageKey, jid, conteudo]);

        return { id: result.rows[0].id, usuarioId, jid };
    }, null, 'Erro ao registrar mensagem enviada');
}

/**
 * Busca última mensagem não respondida para um JID
 */
export async function getUltimaMensagemNaoRespondida(jid) {
    return safeQuery(async () => {
        const result = await pool.query(`
            SELECT * FROM mensagens_enviadas
            WHERE jid = $1 AND respondido = FALSE AND nudge_enviado = FALSE
            ORDER BY enviado_em DESC
            LIMIT 1
        `, [jid]);

        return result.rows[0] || null;
    }, null, `Erro ao buscar mensagem não respondida: ${jid}`);
}

/**
 * Marca mensagens como respondidas quando usuário responde
 */
export async function marcarMensagensRespondidas(jid) {
    return safeQuery(async () => {
        const result = await pool.query(`
            UPDATE mensagens_enviadas
            SET respondido = TRUE
            WHERE jid = $1 AND respondido = FALSE
        `, [jid]);

        return result.rowCount;
    }, 0, `Erro ao marcar mensagens como respondidas: ${jid}`);
}

/**
 * Marca uma mensagem como nudge enviado
 */
export async function marcarNudgeEnviado(mensagemId) {
    return safeQuery(async () => {
        const result = await pool.query(`
            UPDATE mensagens_enviadas
            SET nudge_enviado = TRUE
            WHERE id = $1
        `, [mensagemId]);

        return { changes: result.rowCount };
    }, null, `Erro ao marcar nudge enviado: ${mensagemId}`);
}

/**
 * Conta nudges enviados hoje para um JID
 */
export async function contarNudgesHoje(jid) {
    return safeQuery(async () => {
        const result = await pool.query(`
            SELECT COUNT(*) as count FROM mensagens_enviadas
            WHERE jid = $1 AND nudge_enviado = TRUE
            AND DATE(criado_em) = CURRENT_DATE
        `, [jid]);

        return parseInt(result.rows[0]?.count) || 0;
    }, 0, `Erro ao contar nudges de hoje: ${jid}`);
}

/**
 * Verifica se mensagem foi respondida
 */
export async function mensagemFoiRespondida(mensagemId) {
    return safeQuery(async () => {
        const result = await pool.query(
            'SELECT respondido FROM mensagens_enviadas WHERE id = $1',
            [mensagemId]
        );
        return result.rows[0]?.respondido === true;
    }, false, `Erro ao verificar resposta: ${mensagemId}`);
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES PARA MÉTRICAS DE ENGAJAMENTO
// ═══════════════════════════════════════════════════════════════

/**
 * Incrementa métrica de engajamento
 */
export async function incrementarMetrica(usuarioId, campo) {
    return safeQuery(async () => {
        const camposValidos = [
            'mensagens_enviadas', 'mensagens_lidas', 'respostas_recebidas',
            'nudges_enviados', 'nudges_respondidos'
        ];

        if (!camposValidos.includes(campo)) {
            console.warn(`[Database] Campo de métrica inválido: ${campo}`);
            return null;
        }

        // Upsert: insere ou atualiza
        await pool.query(`
            INSERT INTO metricas_engajamento (usuario_id, data, ${campo})
            VALUES ($1, CURRENT_DATE, 1)
            ON CONFLICT (usuario_id, data)
            DO UPDATE SET ${campo} = metricas_engajamento.${campo} + 1
        `, [usuarioId]);

        return { success: true };
    }, null, `Erro ao incrementar métrica ${campo}`);
}

/**
 * Obtém métricas de um usuário
 */
export async function getMetricasUsuario(usuarioId, dias = 30) {
    return safeQuery(async () => {
        const result = await pool.query(`
            SELECT * FROM metricas_engajamento
            WHERE usuario_id = $1
            AND data >= CURRENT_DATE - INTERVAL '${dias} days'
            ORDER BY data DESC
        `, [usuarioId]);

        return result.rows;
    }, [], `Erro ao buscar métricas: ${usuarioId}`);
}

/**
 * Close database connection pool
 */
export async function closeDatabase() {
    await pool.end();
    console.log('[Database] Pool de conexões fechado');
}

/**
 * Health check - verifica conexão com o banco
 */
export async function healthCheck() {
    try {
        const result = await pool.query('SELECT NOW()');
        return { status: 'ok', timestamp: result.rows[0].now };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
}

// Export pool for advanced usage
export { pool };

// Initialize database on module load
initDatabase().catch(err => {
    console.error('[Database] Falha na inicialização:', err.message);
});

// Default export with all functions
export default {
    getUsuario,
    saveUsuario,
    updateUsuario,
    addConversa,
    getHistorico,
    addAgendamento,
    getAgendamentosPendentes,
    marcarAgendamentoEnviado,
    // Nudge tracking
    addMensagemEnviada,
    getUltimaMensagemNaoRespondida,
    marcarMensagensRespondidas,
    marcarNudgeEnviado,
    contarNudgesHoje,
    mensagemFoiRespondida,
    // Métricas
    incrementarMetrica,
    getMetricasUsuario,
    closeDatabase,
    healthCheck,
    pool
};
