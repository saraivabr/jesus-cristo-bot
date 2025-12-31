import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, 'data');
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const dbPath = join(dataDir, 'jesus.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Create tables
function initDatabase() {
    // Tabela de usuários
    db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telefone TEXT UNIQUE NOT NULL,
            nome TEXT,
            familia TEXT DEFAULT '{}',
            trabalho TEXT DEFAULT '{}',
            jornada_espiritual TEXT DEFAULT '{}',
            ultimo_contato TEXT,
            proximo_followup TEXT,
            horario_preferido TEXT,
            nivel TEXT DEFAULT 'curioso',
            ensinos_recentes TEXT DEFAULT '[]',
            ultimo_ensino_index INTEGER DEFAULT 0,
            desafios_realizados TEXT DEFAULT '[]',
            video_boasvindas_enviado INTEGER DEFAULT 0,
            criado_em TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Adiciona colunas se não existirem (migração)
    try {
        db.exec(`ALTER TABLE usuarios ADD COLUMN nivel TEXT DEFAULT 'curioso'`);
    } catch (e) { /* coluna já existe */ }
    try {
        db.exec(`ALTER TABLE usuarios ADD COLUMN ensinos_recentes TEXT DEFAULT '[]'`);
    } catch (e) { /* coluna já existe */ }
    try {
        db.exec(`ALTER TABLE usuarios ADD COLUMN ultimo_ensino_index INTEGER DEFAULT 0`);
    } catch (e) { /* coluna já existe */ }
    try {
        db.exec(`ALTER TABLE usuarios ADD COLUMN desafios_realizados TEXT DEFAULT '[]'`);
    } catch (e) { /* coluna já existe */ }
    try {
        db.exec(`ALTER TABLE usuarios ADD COLUMN video_boasvindas_enviado INTEGER DEFAULT 0`);
    } catch (e) { /* coluna já existe */ }

    // Tabela de conversas
    db.exec(`
        CREATE TABLE IF NOT EXISTS conversas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            mensagem TEXT NOT NULL,
            resposta TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )
    `);

    // Tabela de agendamentos
    db.exec(`
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            data_hora TEXT NOT NULL,
            mensagem TEXT NOT NULL,
            enviado INTEGER DEFAULT 0,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )
    `);

    // Create indexes for better performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_usuarios_telefone ON usuarios(telefone);
        CREATE INDEX IF NOT EXISTS idx_conversas_usuario_id ON conversas(usuario_id);
        CREATE INDEX IF NOT EXISTS idx_conversas_timestamp ON conversas(timestamp);
        CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_id ON agendamentos(usuario_id);
        CREATE INDEX IF NOT EXISTS idx_agendamentos_data_hora ON agendamentos(data_hora);
        CREATE INDEX IF NOT EXISTS idx_agendamentos_enviado ON agendamentos(enviado);
    `);

    // Tabela de mensagens enviadas para tracking de leitura/nudge
    db.exec(`
        CREATE TABLE IF NOT EXISTS mensagens_enviadas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            message_key TEXT,
            jid TEXT NOT NULL,
            conteudo TEXT,
            enviado_em TEXT NOT NULL,
            entregue_em TEXT,
            lido_em TEXT,
            respondido INTEGER DEFAULT 0,
            nudge_enviado INTEGER DEFAULT 0,
            criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )
    `);

    // Indexes para mensagens_enviadas
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_mensagens_jid ON mensagens_enviadas(jid);
        CREATE INDEX IF NOT EXISTS idx_mensagens_respondido ON mensagens_enviadas(respondido);
        CREATE INDEX IF NOT EXISTS idx_mensagens_nudge ON mensagens_enviadas(nudge_enviado);
    `);

    // Tabela de métricas de engajamento
    db.exec(`
        CREATE TABLE IF NOT EXISTS metricas_engajamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            data TEXT NOT NULL,
            mensagens_enviadas INTEGER DEFAULT 0,
            mensagens_lidas INTEGER DEFAULT 0,
            respostas_recebidas INTEGER DEFAULT 0,
            nudges_enviados INTEGER DEFAULT 0,
            nudges_respondidos INTEGER DEFAULT 0,
            tempo_medio_resposta INTEGER,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            UNIQUE(usuario_id, data)
        )
    `);

    // ═══════════════════════════════════════════════════════════════
    // TABELAS PARA SISTEMA RAG (Retrieval-Augmented Generation)
    // ═══════════════════════════════════════════════════════════════

    // Tabela de embeddings de conhecimento bíblico/histórico
    db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_embeddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            reference TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding TEXT NOT NULL,
            themes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Índices para knowledge_embeddings
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_embeddings(source);
        CREATE INDEX IF NOT EXISTS idx_knowledge_reference ON knowledge_embeddings(reference);
    `);

    // Tabela de memória semântica por usuário
    db.exec(`
        CREATE TABLE IF NOT EXISTS semantic_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jid TEXT NOT NULL,
            summary TEXT NOT NULL,
            embedding TEXT NOT NULL,
            emotional_context TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        )
    `);

    // Índices para semantic_memory
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_semantic_jid ON semantic_memory(jid);
        CREATE INDEX IF NOT EXISTS idx_semantic_created ON semantic_memory(created_at);
        CREATE INDEX IF NOT EXISTS idx_semantic_expires ON semantic_memory(expires_at);
    `);

    // Tabela de cache de embeddings
    db.exec(`
        CREATE TABLE IF NOT EXISTS embedding_cache (
            hash TEXT PRIMARY KEY,
            embedding TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ═══════════════════════════════════════════════════════════════
    // TABELA PARA SISTEMA DE INDICAÇÃO DE GRAÇA (REFERRAL)
    // ═══════════════════════════════════════════════════════════════

    db.exec(`
        CREATE TABLE IF NOT EXISTS grace_referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_jid TEXT NOT NULL,
            referrer_name TEXT,
            referred_phone TEXT NOT NULL,
            referred_name TEXT,
            context TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            contacted_at DATETIME
        )
    `);

    // Índices para grace_referrals
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_grace_referrer ON grace_referrals(referrer_jid);
        CREATE INDEX IF NOT EXISTS idx_grace_status ON grace_referrals(status);
        CREATE INDEX IF NOT EXISTS idx_grace_referred ON grace_referrals(referred_phone);
    `);

    // ═══════════════════════════════════════════════════════════════
    // TABELAS PARA DATAS ESPECIAIS E JORNADA ESPIRITUAL
    // ═══════════════════════════════════════════════════════════════

    db.exec(`
        CREATE TABLE IF NOT EXISTS user_special_dates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            tipo TEXT, -- 'aniversario', 'marco', 'data_especial'
            data TEXT, -- MM-DD ou YYYY-MM-DD
            descricao TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_special_dates_usuario ON user_special_dates(usuario_id);
        CREATE INDEX IF NOT EXISTS idx_special_dates_data ON user_special_dates(data);
        CREATE INDEX IF NOT EXISTS idx_special_dates_tipo ON user_special_dates(tipo);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS user_journey (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            data DATE NOT NULL,
            humor TEXT, -- 'positivo', 'neutro', 'negativo', 'crise'
            temas TEXT, -- JSON
            nivel_engajamento INTEGER, -- 1-10
            desafio_proposto TEXT,
            desafio_completado INTEGER DEFAULT 0,
            notas TEXT,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            UNIQUE(usuario_id, data)
        )
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_journey_usuario ON user_journey(usuario_id);
        CREATE INDEX IF NOT EXISTS idx_journey_data ON user_journey(data);
        CREATE INDEX IF NOT EXISTS idx_journey_humor ON user_journey(humor);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS emotional_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            dia_semana INTEGER, -- 0-6 (domingo-sábado)
            hora_pico INTEGER, -- 0-23
            humor_predominante TEXT,
            gatilhos TEXT, -- JSON array
            ultima_atualizacao DATETIME,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            UNIQUE(usuario_id, dia_semana)
        )
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_patterns_usuario ON emotional_patterns(usuario_id);
        CREATE INDEX IF NOT EXISTS idx_patterns_dia ON emotional_patterns(dia_semana);
    `);
}

// Initialize database on module load
initDatabase();

/**
 * Safe wrapper for database queries
 * @param {Function} fn - Query function to execute
 * @param {any} fallback - Fallback value if query fails
 * @param {string} errorMsg - Error message for logging
 * @returns {any} Query result or fallback
 */
function safeQuery(fn, fallback = null, errorMsg = 'Database error') {
    try {
        return fn();
    } catch (error) {
        console.error(`[Database] ${errorMsg}:`, error.message);
        return fallback;
    }
}

/**
 * Safely parse JSON with fallback and type validation
 * @param {string} jsonString - String to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @param {string} expectedType - Expected type ('object' or 'array')
 * @returns {any} Parsed value or fallback
 */
function safeJsonParse(jsonString, fallback = {}, expectedType = 'object') {
    if (!jsonString || jsonString === 'null' || jsonString === 'undefined') {
        return fallback;
    }

    try {
        const parsed = JSON.parse(jsonString);

        // Validate expected type
        if (expectedType === 'array' && !Array.isArray(parsed)) {
            console.warn('[Database] Esperava array, recebeu:', typeof parsed);
            return fallback;
        }
        if (expectedType === 'object' && (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null)) {
            console.warn('[Database] Esperava object, recebeu:', typeof parsed);
            return fallback;
        }

        return parsed;
    } catch (e) {
        // Se não é JSON válido, tenta interpretar como valor simples
        // Ex: "pai solo" vira { info: "pai solo" }
        if (typeof jsonString === 'string' && jsonString.trim()) {
            console.warn(`[Database] Campo não é JSON válido, convertendo: "${String(jsonString).substring(0, 50)}..."`);
            return Array.isArray(fallback) ? [jsonString] : { info: jsonString };
        }
        return fallback;
    }
}

/**
 * Get user by phone number
 * @param {string} telefone - Phone number
 * @returns {object|null} User object or null if not found
 */
export function getUsuario(telefone) {
    return safeQuery(() => {
        const stmt = db.prepare('SELECT * FROM usuarios WHERE telefone = ?');
        const usuario = stmt.get(telefone);

        if (usuario) {
            // Parse JSON fields with safe fallback and type validation
            usuario.familia = safeJsonParse(usuario.familia, {}, 'object');
            usuario.trabalho = safeJsonParse(usuario.trabalho, {}, 'object');
            usuario.jornada_espiritual = safeJsonParse(usuario.jornada_espiritual, {}, 'object');
            usuario.ensinos_recentes = safeJsonParse(usuario.ensinos_recentes, [], 'array');
            usuario.desafios_realizados = safeJsonParse(usuario.desafios_realizados, [], 'array');
            usuario.video_boasvindas_enviado = !!usuario.video_boasvindas_enviado;
        }

        return usuario;
    }, null, `Erro ao buscar usuário: ${telefone}`);
}

/**
 * Save a new user
 * @param {object} userData - User data object
 * @param {string} userData.telefone - Phone number (required)
 * @param {string} userData.nome - User name
 * @param {object} userData.familia - Family information (JSON)
 * @param {object} userData.trabalho - Work information (JSON)
 * @param {object} userData.jornada_espiritual - Spiritual journey (JSON)
 * @param {string} userData.horario_preferido - Preferred time
 * @returns {object} Created user object
 */
export function saveUsuario(userData) {
    return safeQuery(() => {
        const {
            telefone,
            nome = null,
            familia = {},
            trabalho = {},
            jornada_espiritual = {},
            horario_preferido = null
        } = userData;

        // Ensure we're saving valid JSON objects
        const safeStringify = (value) => {
            if (typeof value === 'string') {
                try {
                    JSON.parse(value);
                    return value; // Already valid JSON string
                } catch {
                    return JSON.stringify({ info: value });
                }
            }
            return JSON.stringify(value || {});
        };

        const stmt = db.prepare(`
            INSERT INTO usuarios (
                telefone, nome, familia, trabalho, jornada_espiritual,
                horario_preferido, ultimo_contato
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        stmt.run(
            telefone,
            nome,
            safeStringify(familia),
            safeStringify(trabalho),
            safeStringify(jornada_espiritual),
            horario_preferido
        );

        return getUsuario(telefone);
    }, null, `Erro ao salvar usuário: ${userData?.telefone}`);
}

/**
 * Delete a user and all associated data (cascade deletion)
 * @param {number} usuarioId - User ID to delete
 * @returns {boolean} Success
 */
export function deleteUsuario(usuarioId) {
    return safeQuery(() => {
        // Deleta em cascata: conversas, agendamentos, mensagens, jornada, datas especiais, padrões emocionais
        db.prepare('DELETE FROM conversas WHERE usuario_id = ?').run(usuarioId);
        db.prepare('DELETE FROM agendamentos WHERE usuario_id = ?').run(usuarioId);
        db.prepare('DELETE FROM mensagens_enviadas WHERE usuario_id = ?').run(usuarioId);
        db.prepare('DELETE FROM user_journey WHERE usuario_id = ?').run(usuarioId);
        db.prepare('DELETE FROM user_special_dates WHERE usuario_id = ?').run(usuarioId);
        db.prepare('DELETE FROM emotional_patterns WHERE usuario_id = ?').run(usuarioId);
        db.prepare('DELETE FROM metricas_engajamento WHERE usuario_id = ?').run(usuarioId);
        db.prepare('DELETE FROM semantic_memory WHERE usuario_id = ?').run(usuarioId);
        db.prepare('DELETE FROM usuarios WHERE id = ?').run(usuarioId);
        return true;
    }, false, `deleteUsuario(${usuarioId})`);
}

/**
 * Update existing user
 * @param {string} telefone - Phone number
 * @param {object} updates - Fields to update
 * @returns {object} Updated user object
 */
export function updateUsuario(telefone, updates) {
    return safeQuery(() => {
        const usuario = getUsuario(telefone);
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

        // Safe stringify that prevents double serialization
        const safeStringify = (value) => {
            if (value === null || value === undefined) return null;
            if (typeof value === 'string') {
                try {
                    JSON.parse(value);
                    return value; // Already valid JSON string
                } catch {
                    return JSON.stringify({ info: value });
                }
            }
            return JSON.stringify(value);
        };

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClauses.push(`${key} = ?`);

                // Stringify objects safely (avoid double serialization)
                if (typeof value === 'object' && value !== null) {
                    values.push(safeStringify(value));
                } else {
                    values.push(value);
                }
            }
        }

        // Always update ultimo_contato
        setClauses.push('ultimo_contato = CURRENT_TIMESTAMP');

        if (setClauses.length > 0) {
            const sql = `UPDATE usuarios SET ${setClauses.join(', ')} WHERE telefone = ?`;
            values.push(telefone);

            const stmt = db.prepare(sql);
            stmt.run(...values);
        }

        return getUsuario(telefone);
    }, null, `Erro ao atualizar usuário: ${telefone}`);
}

/**
 * Add a conversation entry
 * @param {number} usuarioId - User ID
 * @param {string} mensagem - User message
 * @param {string} resposta - Bot response
 * @returns {object} Created conversation entry
 */
export function addConversa(usuarioId, mensagem, resposta = null) {
    return safeQuery(() => {
        // Validate inputs
        if (!usuarioId) {
            console.warn('[Database] addConversa: usuarioId inválido');
            return null;
        }

        const safeMensagem = typeof mensagem === 'string' ? mensagem : String(mensagem || '');
        const safeResposta = resposta ? (typeof resposta === 'string' ? resposta : String(resposta)) : null;

        const stmt = db.prepare(`
            INSERT INTO conversas (usuario_id, mensagem, resposta)
            VALUES (?, ?, ?)
        `);

        const info = stmt.run(usuarioId, safeMensagem, safeResposta);

        const getStmt = db.prepare('SELECT * FROM conversas WHERE id = ?');
        return getStmt.get(info.lastInsertRowid);
    }, null, `Erro ao adicionar conversa para usuário: ${usuarioId}`);
}

/**
 * Get conversation history for a user
 * @param {number} usuarioId - User ID
 * @param {number} limit - Maximum number of messages to retrieve (default: 50)
 * @returns {array} Array of conversation entries
 */
export function getHistorico(usuarioId, limit = 50) {
    return safeQuery(() => {
        if (!usuarioId) return [];

        const stmt = db.prepare(`
            SELECT * FROM conversas
            WHERE usuario_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `);

        const conversas = stmt.all(usuarioId, limit);

        // Return in chronological order (oldest first)
        return conversas.reverse();
    }, [], `Erro ao buscar histórico do usuário: ${usuarioId}`);
}

/**
 * Add a scheduled message
 * @param {object} agendamento - Scheduling data
 * @param {number} agendamento.usuarioId - User ID
 * @param {string} agendamento.tipo - Type of scheduling (followup, lembrete, etc)
 * @param {string} agendamento.dataHora - ISO datetime string
 * @param {string} agendamento.mensagem - Message to send
 * @returns {object} Created scheduling entry
 */
export function addAgendamento({ usuarioId, tipo, dataHora, mensagem }) {
    const stmt = db.prepare(`
        INSERT INTO agendamentos (usuario_id, tipo, data_hora, mensagem)
        VALUES (?, ?, ?, ?)
    `);

    const info = stmt.run(usuarioId, tipo, dataHora, mensagem);

    const getStmt = db.prepare('SELECT * FROM agendamentos WHERE id = ?');
    return getStmt.get(info.lastInsertRowid);
}

/**
 * Get pending scheduled messages
 * @param {string} beforeTime - ISO datetime string (default: current time)
 * @returns {array} Array of pending scheduled messages
 */
export function getAgendamentosPendentes(beforeTime = null) {
    return safeQuery(() => {
        const cutoff = beforeTime ? new Date(beforeTime).getTime() : Date.now();

        // Validate cutoff
        if (Number.isNaN(cutoff)) {
            console.warn('[Database] getAgendamentosPendentes: cutoff inválido');
            return [];
        }

        const stmt = db.prepare(`
            SELECT a.*, u.telefone, u.nome
            FROM agendamentos a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE a.enviado = 0
            ORDER BY a.data_hora ASC
        `);

        const rows = stmt.all();

        return rows.filter(row => {
            if (!row.data_hora) return false;
            const agendamentoTime = new Date(row.data_hora).getTime();
            if (Number.isNaN(agendamentoTime)) {
                console.warn(`[Database] Data inválida no agendamento ${row.id}: ${row.data_hora}`);
                return false;
            }
            return agendamentoTime <= cutoff;
        });
    }, [], 'Erro ao buscar agendamentos pendentes');
}

/**
 * Mark a scheduled message as sent
 * @param {number} agendamentoId - Scheduling ID
 * @returns {object} Update result
 */
export function marcarAgendamentoEnviado(agendamentoId) {
    const stmt = db.prepare(`
        UPDATE agendamentos
        SET enviado = 1
        WHERE id = ?
    `);

    return stmt.run(agendamentoId);
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES PARA MENSAGENS ENVIADAS (TRACKING DE NUDGE)
// ═══════════════════════════════════════════════════════════════

/**
 * Registra uma mensagem enviada para tracking
 * @param {object} data - Dados da mensagem
 * @returns {object} Registro criado
 */
export function addMensagemEnviada({ usuarioId, messageKey, jid, conteudo }) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            INSERT INTO mensagens_enviadas (usuario_id, message_key, jid, conteudo, enviado_em)
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = stmt.run(usuarioId, messageKey, jid, conteudo, new Date().toISOString());
        return { id: info.lastInsertRowid, usuarioId, jid };
    }, null, 'Erro ao registrar mensagem enviada');
}

/**
 * Busca última mensagem não respondida para um JID
 * @param {string} jid - WhatsApp JID
 * @returns {object|null} Mensagem ou null
 */
export function getUltimaMensagemNaoRespondida(jid) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT * FROM mensagens_enviadas
            WHERE jid = ? AND respondido = 0 AND nudge_enviado = 0
            ORDER BY enviado_em DESC
            LIMIT 1
        `);
        return stmt.get(jid);
    }, null, `Erro ao buscar mensagem não respondida: ${jid}`);
}

/**
 * Marca mensagens como respondidas quando usuário responde
 * @param {string} jid - WhatsApp JID
 * @returns {number} Quantidade de mensagens atualizadas
 */
export function marcarMensagensRespondidas(jid) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            UPDATE mensagens_enviadas
            SET respondido = 1
            WHERE jid = ? AND respondido = 0
        `);
        const result = stmt.run(jid);
        return result.changes;
    }, 0, `Erro ao marcar mensagens como respondidas: ${jid}`);
}

/**
 * Marca uma mensagem como nudge enviado
 * @param {number} mensagemId - ID da mensagem
 */
export function marcarNudgeEnviado(mensagemId) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            UPDATE mensagens_enviadas
            SET nudge_enviado = 1
            WHERE id = ?
        `);
        return stmt.run(mensagemId);
    }, null, `Erro ao marcar nudge enviado: ${mensagemId}`);
}

/**
 * Conta nudges enviados hoje para um JID
 * @param {string} jid - WhatsApp JID
 * @returns {number} Quantidade de nudges hoje
 */
export function contarNudgesHoje(jid) {
    return safeQuery(() => {
        const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const stmt = db.prepare(`
            SELECT COUNT(*) as count FROM mensagens_enviadas
            WHERE jid = ? AND nudge_enviado = 1
            AND date(criado_em) = ?
        `);
        const result = stmt.get(jid, hoje);
        return result?.count || 0;
    }, 0, `Erro ao contar nudges de hoje: ${jid}`);
}

/**
 * Verifica se mensagem foi respondida
 * @param {number} mensagemId - ID da mensagem
 * @returns {boolean}
 */
export function mensagemFoiRespondida(mensagemId) {
    return safeQuery(() => {
        const stmt = db.prepare('SELECT respondido FROM mensagens_enviadas WHERE id = ?');
        const result = stmt.get(mensagemId);
        return result?.respondido === 1;
    }, false, `Erro ao verificar resposta: ${mensagemId}`);
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES PARA MÉTRICAS DE ENGAJAMENTO
// ═══════════════════════════════════════════════════════════════

/**
 * Incrementa métrica de engajamento
 * @param {number} usuarioId - ID do usuário
 * @param {string} campo - Campo a incrementar
 */
export function incrementarMetrica(usuarioId, campo) {
    return safeQuery(() => {
        const hoje = new Date().toISOString().split('T')[0];
        const camposValidos = [
            'mensagens_enviadas', 'mensagens_lidas', 'respostas_recebidas',
            'nudges_enviados', 'nudges_respondidos'
        ];

        if (!camposValidos.includes(campo)) {
            console.warn(`[Database] Campo de métrica inválido: ${campo}`);
            return null;
        }

        // Upsert: insere ou atualiza
        const stmt = db.prepare(`
            INSERT INTO metricas_engajamento (usuario_id, data, ${campo})
            VALUES (?, ?, 1)
            ON CONFLICT(usuario_id, data)
            DO UPDATE SET ${campo} = ${campo} + 1
        `);
        return stmt.run(usuarioId, hoje);
    }, null, `Erro ao incrementar métrica ${campo}`);
}

/**
 * Obtém métricas de um usuário
 * @param {number} usuarioId - ID do usuário
 * @param {number} dias - Últimos N dias (default: 30)
 * @returns {array} Métricas
 */
export function getMetricasUsuario(usuarioId, dias = 30) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT * FROM metricas_engajamento
            WHERE usuario_id = ?
            AND date(data) >= date('now', '-' || ? || ' days')
            ORDER BY data DESC
        `);
        return stmt.all(usuarioId, dias);
    }, [], `Erro ao buscar métricas: ${usuarioId}`);
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES PARA SISTEMA RAG (Retrieval-Augmented Generation)
// ═══════════════════════════════════════════════════════════════

/**
 * Salva um embedding de conhecimento bíblico/histórico
 * @param {string} source - Fonte (evangelhos, historico, parabolas)
 * @param {string} reference - Referência (ex: mateus:5:1-12)
 * @param {string} content - Conteúdo textual
 * @param {number[]} embedding - Vetor de embedding
 * @param {string[]} themes - Array de temas relacionados
 * @returns {object} Registro criado
 */
export function saveKnowledgeEmbedding(source, reference, content, embedding, themes) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            INSERT INTO knowledge_embeddings (source, reference, content, embedding, themes)
            VALUES (?, ?, ?, ?, ?)
        `);

        const embeddingJson = JSON.stringify(embedding);
        const themesJson = themes ? JSON.stringify(themes) : null;

        const info = stmt.run(source, reference, content, embeddingJson, themesJson);

        return {
            id: info.lastInsertRowid,
            source,
            reference,
            content,
            embedding,
            themes
        };
    }, null, `Erro ao salvar knowledge embedding: ${reference}`);
}

/**
 * Obtém todos os embeddings de uma fonte específica
 * @param {string} source - Fonte (evangelhos, historico, parabolas)
 * @returns {array} Array de embeddings com vetores parseados
 */
export function getKnowledgeEmbeddings(source) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT * FROM knowledge_embeddings
            WHERE source = ?
            ORDER BY reference ASC
        `);

        const rows = stmt.all(source);

        return rows.map(row => ({
            ...row,
            embedding: safeJsonParse(row.embedding, [], 'array'),
            themes: safeJsonParse(row.themes, [], 'array')
        }));
    }, [], `Erro ao buscar knowledge embeddings: ${source}`);
}

/**
 * Obtém todos os embeddings de conhecimento (para busca semântica)
 * @returns {array} Array de todos os embeddings
 */
export function getAllKnowledgeEmbeddings() {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT * FROM knowledge_embeddings
            ORDER BY source, reference ASC
        `);

        const rows = stmt.all();

        return rows.map(row => ({
            ...row,
            embedding: safeJsonParse(row.embedding, [], 'array'),
            themes: safeJsonParse(row.themes, [], 'array')
        }));
    }, [], 'Erro ao buscar todos os knowledge embeddings');
}

/**
 * Salva uma memória semântica para um usuário
 * @param {string} jid - WhatsApp JID do usuário
 * @param {string} summary - Resumo da conversa/contexto
 * @param {number[]} embedding - Vetor de embedding
 * @param {string} emotionalContext - Contexto emocional (opcional)
 * @param {string} expiresAt - Data de expiração ISO (opcional)
 * @returns {object} Registro criado
 */
export function saveSemanticMemory(jid, summary, embedding, emotionalContext = null, expiresAt = null) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            INSERT INTO semantic_memory (jid, summary, embedding, emotional_context, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        const embeddingJson = JSON.stringify(embedding);

        const info = stmt.run(jid, summary, embeddingJson, emotionalContext, expiresAt);

        return {
            id: info.lastInsertRowid,
            jid,
            summary,
            embedding,
            emotionalContext,
            expiresAt
        };
    }, null, `Erro ao salvar semantic memory: ${jid}`);
}

/**
 * Obtém memórias semânticas de um usuário
 * @param {string} jid - WhatsApp JID do usuário
 * @param {number} limit - Limite de resultados (default: 10)
 * @returns {array} Array de memórias com embeddings parseados
 */
export function getSemanticMemories(jid, limit = 10) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT * FROM semantic_memory
            WHERE jid = ?
            AND (expires_at IS NULL OR expires_at > datetime('now'))
            ORDER BY created_at DESC
            LIMIT ?
        `);

        const rows = stmt.all(jid, limit);

        return rows.map(row => ({
            ...row,
            embedding: safeJsonParse(row.embedding, [], 'array')
        }));
    }, [], `Erro ao buscar semantic memories: ${jid}`);
}

/**
 * Remove memórias antigas mantendo apenas as N mais recentes
 * @param {string} jid - WhatsApp JID do usuário
 * @param {number} maxCount - Número máximo de memórias a manter
 * @returns {number} Número de memórias deletadas
 */
export function deleteOldMemories(jid, maxCount) {
    return safeQuery(() => {
        // Primeiro, obtém os IDs das memórias a manter
        const keepStmt = db.prepare(`
            SELECT id FROM semantic_memory
            WHERE jid = ?
            ORDER BY created_at DESC
            LIMIT ?
        `);

        const keepIds = keepStmt.all(jid, maxCount).map(row => row.id);

        if (keepIds.length === 0) {
            // Deleta todas se não há memórias a manter
            const deleteAllStmt = db.prepare(`
                DELETE FROM semantic_memory WHERE jid = ?
            `);
            const result = deleteAllStmt.run(jid);
            return result.changes;
        }

        // Deleta as que não estão na lista de manter
        const placeholders = keepIds.map(() => '?').join(',');
        const deleteStmt = db.prepare(`
            DELETE FROM semantic_memory
            WHERE jid = ? AND id NOT IN (${placeholders})
        `);

        const result = deleteStmt.run(jid, ...keepIds);
        return result.changes;
    }, 0, `Erro ao deletar memórias antigas: ${jid}`);
}

/**
 * Remove memórias expiradas de todos os usuários
 * @returns {number} Número de memórias deletadas
 */
export function cleanupExpiredMemories() {
    return safeQuery(() => {
        const stmt = db.prepare(`
            DELETE FROM semantic_memory
            WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')
        `);
        const result = stmt.run();
        return result.changes;
    }, 0, 'Erro ao limpar memórias expiradas');
}

/**
 * Salva um embedding no cache
 * @param {string} hash - Hash único do texto
 * @param {number[]} embedding - Vetor de embedding
 * @returns {object} Registro criado/atualizado
 */
export function cacheEmbedding(hash, embedding) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO embedding_cache (hash, embedding, created_at)
            VALUES (?, ?, datetime('now'))
        `);

        const embeddingJson = JSON.stringify(embedding);
        stmt.run(hash, embeddingJson);

        return { hash, embedding };
    }, null, `Erro ao cachear embedding: ${hash}`);
}

/**
 * Obtém um embedding do cache
 * @param {string} hash - Hash único do texto
 * @returns {number[]|null} Vetor de embedding ou null se não encontrado
 */
export function getCachedEmbedding(hash) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT embedding FROM embedding_cache WHERE hash = ?
        `);

        const row = stmt.get(hash);

        if (!row) return null;

        return safeJsonParse(row.embedding, null, 'array');
    }, null, `Erro ao buscar embedding cacheado: ${hash}`);
}

/**
 * Limpa embeddings antigos do cache (mais de N dias)
 * @param {number} days - Dias de idade máxima (default: 30)
 * @returns {number} Número de entradas deletadas
 */
export function cleanupOldEmbeddingCache(days = 30) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            DELETE FROM embedding_cache
            WHERE created_at < datetime('now', '-' || ? || ' days')
        `);
        const result = stmt.run(days);
        return result.changes;
    }, 0, 'Erro ao limpar cache de embeddings antigo');
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES PARA SISTEMA DE INDICAÇÃO DE GRAÇA (REFERRAL)
// ═══════════════════════════════════════════════════════════════

/**
 * Cria um novo referral de graça
 * @param {object} data - Dados do referral
 * @returns {object} Referral criado
 */
export function createGraceReferral({ referrer_jid, referrer_name, referred_phone, referred_name, context, status = 'pending' }) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            INSERT INTO grace_referrals (referrer_jid, referrer_name, referred_phone, referred_name, context, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(referrer_jid, referrer_name, referred_phone, referred_name, context, status);

        return {
            id: info.lastInsertRowid,
            referrer_jid,
            referrer_name,
            referred_phone,
            referred_name,
            context,
            status
        };
    }, null, `Erro ao criar grace referral de ${referrer_jid}`);
}

/**
 * Obtém referrals pendentes (não contatados)
 * @param {number} limit - Limite de resultados
 * @returns {array} Array de referrals pendentes
 */
export function getPendingGraceReferrals(limit = 10) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT * FROM grace_referrals
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT ?
        `);
        return stmt.all(limit);
    }, [], 'Erro ao buscar grace referrals pendentes');
}

/**
 * Atualiza o status de um referral
 * @param {number} referralId - ID do referral
 * @param {string} status - Novo status
 * @returns {boolean} Sucesso
 */
export function updateGraceReferralStatus(referralId, status) {
    return safeQuery(() => {
        const contactedAt = status === 'contacted' ? new Date().toISOString() : null;

        const stmt = db.prepare(`
            UPDATE grace_referrals
            SET status = ?, contacted_at = COALESCE(?, contacted_at)
            WHERE id = ?
        `);

        const result = stmt.run(status, contactedAt, referralId);
        return result.changes > 0;
    }, false, `Erro ao atualizar status do referral ${referralId}`);
}

/**
 * Conta referrals feitos hoje por um usuário
 * @param {string} jid - WhatsApp JID
 * @returns {number} Quantidade de referrals hoje
 */
export function getTodayReferralCount(jid) {
    return safeQuery(() => {
        const hoje = new Date().toISOString().split('T')[0];
        const stmt = db.prepare(`
            SELECT COUNT(*) as count FROM grace_referrals
            WHERE referrer_jid = ?
            AND date(created_at) = ?
        `);
        const result = stmt.get(jid, hoje);
        return result?.count || 0;
    }, 0, `Erro ao contar referrals de hoje: ${jid}`);
}

/**
 * Obtém um referral por ID
 * @param {number} referralId - ID do referral
 * @returns {object|null} Referral ou null
 */
export function getGraceReferral(referralId) {
    return safeQuery(() => {
        const stmt = db.prepare('SELECT * FROM grace_referrals WHERE id = ?');
        return stmt.get(referralId);
    }, null, `Erro ao buscar referral ${referralId}`);
}

/**
 * Verifica se um número já foi indicado recentemente
 * @param {string} phone - Número do telefone
 * @param {number} daysBack - Dias para verificar
 * @returns {boolean} True se já foi indicado
 */
export function wasRecentlyReferred(phone, daysBack = 7) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT COUNT(*) as count FROM grace_referrals
            WHERE referred_phone = ?
            AND created_at > datetime('now', '-' || ? || ' days')
        `);
        const result = stmt.get(phone, daysBack);
        return (result?.count || 0) > 0;
    }, false, `Erro ao verificar referral recente: ${phone}`);
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES PARA DATAS ESPECIAIS E JORNADA ESPIRITUAL
// ═══════════════════════════════════════════════════════════════

/**
 * Adiciona uma data especial para um usuário
 * @param {number} usuarioId - ID do usuário
 * @param {string} tipo - Tipo: 'aniversario', 'marco', 'data_especial'
 * @param {string} data - MM-DD ou YYYY-MM-DD
 * @param {string} descricao - Descrição da data
 * @returns {object} Registro criado
 */
export function addSpecialDate(usuarioId, tipo, data, descricao) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            INSERT INTO user_special_dates (usuario_id, tipo, data, descricao)
            VALUES (?, ?, ?, ?)
        `);

        const info = stmt.run(usuarioId, tipo, data, descricao);
        const getStmt = db.prepare('SELECT * FROM user_special_dates WHERE id = ?');
        return getStmt.get(info.lastInsertRowid);
    }, null, `Erro ao adicionar data especial: ${usuarioId}`);
}

/**
 * Obtém datas especiais próximas
 * @param {number} dias - Próximos X dias
 * @param {number} limit - Limite de resultados
 * @returns {array} Array de datas especiais próximas
 */
export function getUpcomingSpecialDates(dias = 7, limit = 20) {
    return safeQuery(() => {
        const hoje = new Date().toISOString().split('T')[0];
        const dataFutura = new Date();
        dataFutura.setDate(dataFutura.getDate() + dias);
        const futuro = dataFutura.toISOString().split('T')[0];

        // Busca datas no período (considerando apenas mês-dia para datas recorrentes)
        const stmt = db.prepare(`
            SELECT u.telefone, u.nome, usd.*
            FROM user_special_dates usd
            JOIN usuarios u ON usd.usuario_id = u.id
            WHERE (
                -- Datas com ano específico
                usd.data >= ? AND usd.data <= ?
            ) OR (
                -- Datas recorrentes (MM-DD)
                LENGTH(usd.data) = 5
                AND CAST(SUBSTR(?, 6, 5) AS TEXT) <= usd.data
                AND usd.data <= CAST(SUBSTR(?, 6, 5) AS TEXT)
            )
            ORDER BY SUBSTR(usd.data, -5) ASC
            LIMIT ?
        `);

        return stmt.all(hoje, futuro, hoje, futuro, limit);
    }, [], 'Erro ao buscar datas especiais próximas');
}

/**
 * Obtém datas especiais de hoje
 * @param {number} limit - Limite de resultados
 * @returns {array} Array de datas especiais hoje
 */
export function getTodaySpecialDates(limit = 10) {
    return safeQuery(() => {
        const hoje = new Date().toISOString().split('T')[0];
        const hojeMD = hoje.substring(5); // MM-DD

        const stmt = db.prepare(`
            SELECT u.telefone, u.nome, usd.*
            FROM user_special_dates usd
            JOIN usuarios u ON usd.usuario_id = u.id
            WHERE usd.data = ? OR SUBSTR(usd.data, 6) = ?
            ORDER BY usd.tipo ASC
            LIMIT ?
        `);

        return stmt.all(hoje, hojeMD, limit);
    }, [], 'Erro ao buscar datas especiais de hoje');
}

/**
 * Adiciona uma entrada de jornada espiritual
 * @param {number} usuarioId - ID do usuário
 * @param {string} data - Data (YYYY-MM-DD)
 * @param {string} humor - Humor: 'positivo', 'neutro', 'negativo', 'crise'
 * @param {array} temas - Array de temas
 * @param {number} engajamento - Nível 1-10
 * @param {string} desafio - Desafio proposto
 * @returns {object} Registro criado
 */
export function addJourneyEntry(usuarioId, data, humor, temas = [], engajamento = 5, desafio = null) {
    return safeQuery(() => {
        const temasJson = JSON.stringify(temas);

        const stmt = db.prepare(`
            INSERT INTO user_journey (usuario_id, data, humor, temas, nivel_engajamento, desafio_proposto)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(usuario_id, data)
            DO UPDATE SET humor = ?, temas = ?, nivel_engajamento = ?, desafio_proposto = ?
        `);

        const info = stmt.run(usuarioId, data, humor, temasJson, engajamento, desafio, humor, temasJson, engajamento, desafio);

        const getStmt = db.prepare('SELECT * FROM user_journey WHERE usuario_id = ? AND data = ?');
        const result = getStmt.get(usuarioId, data);

        if (result && result.temas) {
            result.temas = safeJsonParse(result.temas, [], 'array');
        }
        return result;
    }, null, `Erro ao adicionar entrada de jornada: ${usuarioId}`);
}

/**
 * Marca um desafio como completado
 * @param {number} usuarioId - ID do usuário
 * @param {string} data - Data da entrada
 * @returns {boolean} Sucesso
 */
export function completeChallenge(usuarioId, data) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            UPDATE user_journey
            SET desafio_completado = 1
            WHERE usuario_id = ? AND data = ?
        `);

        const result = stmt.run(usuarioId, data);
        return result.changes > 0;
    }, false, `Erro ao marcar desafio como completado: ${usuarioId}`);
}

/**
 * Obtém resumo da jornada de um usuário
 * @param {number} usuarioId - ID do usuário
 * @param {number} dias - Últimos N dias (default: 30)
 * @returns {object} Resumo com estatísticas
 */
export function getJourneySummary(usuarioId, dias = 30) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT
                COUNT(*) as total_entradas,
                SUM(CASE WHEN humor = 'positivo' THEN 1 ELSE 0 END) as dias_positivos,
                SUM(CASE WHEN humor = 'neutro' THEN 1 ELSE 0 END) as dias_neutros,
                SUM(CASE WHEN humor = 'negativo' THEN 1 ELSE 0 END) as dias_negativos,
                SUM(CASE WHEN humor = 'crise' THEN 1 ELSE 0 END) as dias_crise,
                AVG(nivel_engajamento) as engajamento_medio,
                SUM(CASE WHEN desafio_completado = 1 THEN 1 ELSE 0 END) as desafios_completados,
                MAX(nivel_engajamento) as engajamento_maximo,
                MIN(nivel_engajamento) as engajamento_minimo
            FROM user_journey
            WHERE usuario_id = ?
            AND date(data) >= date('now', '-' || ? || ' days')
        `);

        const summary = stmt.get(usuarioId, dias);

        // Busca também as últimas entradas
        const recentStmt = db.prepare(`
            SELECT * FROM user_journey
            WHERE usuario_id = ?
            ORDER BY data DESC
            LIMIT 10
        `);

        const recentes = recentStmt.all(usuarioId);
        const recentesProcessadas = recentes.map(r => ({
            ...r,
            temas: safeJsonParse(r.temas, [], 'array')
        }));

        return {
            ...summary,
            ultimas_entradas: recentesProcessadas
        };
    }, null, `Erro ao buscar resumo de jornada: ${usuarioId}`);
}

/**
 * Atualiza o padrão emocional de um usuário
 * @param {number} usuarioId - ID do usuário
 * @param {number} diaSemana - 0-6 (domingo-sábado)
 * @param {number} hora - 0-23
 * @param {string} humor - Humor predominante
 * @param {array} gatilhos - Array de gatilhos
 * @returns {object} Padrão atualizado
 */
export function updateEmotionalPattern(usuarioId, diaSemana, hora, humor, gatilhos = []) {
    return safeQuery(() => {
        const gatilhosJson = JSON.stringify(gatilhos);

        const stmt = db.prepare(`
            INSERT INTO emotional_patterns (usuario_id, dia_semana, hora_pico, humor_predominante, gatilhos, ultima_atualizacao)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(usuario_id, dia_semana)
            DO UPDATE SET hora_pico = ?, humor_predominante = ?, gatilhos = ?, ultima_atualizacao = datetime('now')
        `);

        stmt.run(usuarioId, diaSemana, hora, humor, gatilhosJson, hora, humor, gatilhosJson);

        const getStmt = db.prepare('SELECT * FROM emotional_patterns WHERE usuario_id = ? AND dia_semana = ?');
        const result = getStmt.get(usuarioId, diaSemana);

        if (result && result.gatilhos) {
            result.gatilhos = safeJsonParse(result.gatilhos, [], 'array');
        }
        return result;
    }, null, `Erro ao atualizar padrão emocional: ${usuarioId}`);
}

/**
 * Obtém padrões emocionais de um usuário
 * @param {number} usuarioId - ID do usuário
 * @returns {array} Array de padrões por dia da semana
 */
export function getEmotionalPatterns(usuarioId) {
    return safeQuery(() => {
        const stmt = db.prepare(`
            SELECT * FROM emotional_patterns
            WHERE usuario_id = ?
            ORDER BY dia_semana ASC
        `);

        const patterns = stmt.all(usuarioId);

        return patterns.map(p => ({
            ...p,
            gatilhos: safeJsonParse(p.gatilhos, [], 'array')
        }));
    }, [], `Erro ao buscar padrões emocionais: ${usuarioId}`);
}

/**
 * Detecta e analisa ciclos emocionais de um usuário
 * @param {number} usuarioId - ID do usuário
 * @returns {object} Análise de padrões detectados
 */
export function detectPatterns(usuarioId) {
    return safeQuery(() => {
        // Análise de últimos 60 dias
        const journeyStmt = db.prepare(`
            SELECT
                strftime('%w', data) as dia_semana,
                '14' as hora,
                humor,
                nivel_engajamento
            FROM user_journey
            WHERE usuario_id = ?
            AND date(data) >= date('now', '-60 days')
            ORDER BY data DESC
        `);

        const entries = journeyStmt.all(usuarioId);

        // Agrupa por dia da semana
        const diaMap = {};
        const horaMap = {};
        const humorCount = {};

        entries.forEach(entry => {
            const dia = parseInt(entry.dia_semana);
            const hora = parseInt(entry.hora) || 12;
            const humor = entry.humor || 'neutro';

            if (!diaMap[dia]) diaMap[dia] = [];
            diaMap[dia].push(entry);

            if (!horaMap[hora]) horaMap[hora] = [];
            horaMap[hora].push(entry);

            humorCount[humor] = (humorCount[humor] || 0) + 1;
        });

        // Encontra hora mais ativa
        let horaPico = 12;
        let maxHora = 0;
        for (const [hora, dados] of Object.entries(horaMap)) {
            if (dados.length > maxHora) {
                maxHora = dados.length;
                horaPico = parseInt(hora);
            }
        }

        // Encontra humor predominante
        let humorPredominante = 'neutro';
        let maxHumor = 0;
        for (const [humor, count] of Object.entries(humorCount)) {
            if (count > maxHumor) {
                maxHumor = count;
                humorPredominante = humor;
            }
        }

        // Detecta ciclos por dia
        const ciclos = [];
        for (const [dia, dados] of Object.entries(diaMap)) {
            const humorDia = {};
            dados.forEach(d => {
                humorDia[d.humor] = (humorDia[d.humor] || 0) + 1;
            });

            let humor = 'neutro';
            let max = 0;
            for (const [h, count] of Object.entries(humorDia)) {
                if (count > max) {
                    max = count;
                    humor = h;
                }
            }

            ciclos.push({
                dia: parseInt(dia),
                humor,
                frequencia: dados.length,
                engajamento_medio: Math.round(dados.reduce((sum, d) => sum + (d.nivel_engajamento || 5), 0) / dados.length)
            });
        }

        return {
            usuario_id: usuarioId,
            periodo_analise: '60 dias',
            hora_pico: horaPico,
            humor_predominante: humorPredominante,
            ciclos_por_dia: ciclos,
            total_entradas: entries.length
        };
    }, null, `Erro ao detectar padrões: ${usuarioId}`);
}

/**
 * Close database connection
 */
export function closeDatabase() {
    db.close();
}

// Export database instance for advanced usage
export { db };

// Default export with all functions
export default {
    getUsuario,
    saveUsuario,
    updateUsuario,
    deleteUsuario,
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
    // RAG System - Knowledge Embeddings
    saveKnowledgeEmbedding,
    getKnowledgeEmbeddings,
    getAllKnowledgeEmbeddings,
    // RAG System - Semantic Memory
    saveSemanticMemory,
    getSemanticMemories,
    deleteOldMemories,
    cleanupExpiredMemories,
    // RAG System - Embedding Cache
    cacheEmbedding,
    getCachedEmbedding,
    cleanupOldEmbeddingCache,
    // Grace Referral System
    createGraceReferral,
    getPendingGraceReferrals,
    updateGraceReferralStatus,
    getTodayReferralCount,
    getGraceReferral,
    wasRecentlyReferred,
    // Special Dates and Spiritual Journey
    addSpecialDate,
    getUpcomingSpecialDates,
    getTodaySpecialDates,
    addJourneyEntry,
    completeChallenge,
    getJourneySummary,
    updateEmotionalPattern,
    getEmotionalPatterns,
    detectPatterns,
    // Core
    closeDatabase,
    db
};
