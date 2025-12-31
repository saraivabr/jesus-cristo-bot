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

// Enable foreign keys
db.pragma('foreign_keys = ON');

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
}

// Initialize database on module load
initDatabase();

/**
 * Get user by phone number
 * @param {string} telefone - Phone number
 * @returns {object|null} User object or null if not found
 */
export function getUsuario(telefone) {
    const stmt = db.prepare('SELECT * FROM usuarios WHERE telefone = ?');
    const usuario = stmt.get(telefone);

    if (usuario) {
        // Parse JSON fields
        usuario.familia = JSON.parse(usuario.familia || '{}');
        usuario.trabalho = JSON.parse(usuario.trabalho || '{}');
        usuario.jornada_espiritual = JSON.parse(usuario.jornada_espiritual || '{}');
        usuario.ensinos_recentes = JSON.parse(usuario.ensinos_recentes || '[]');
        usuario.desafios_realizados = JSON.parse(usuario.desafios_realizados || '[]');
    }

    return usuario;
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
    const {
        telefone,
        nome = null,
        familia = {},
        trabalho = {},
        jornada_espiritual = {},
        horario_preferido = null
    } = userData;

    const stmt = db.prepare(`
        INSERT INTO usuarios (
            telefone, nome, familia, trabalho, jornada_espiritual,
            horario_preferido, ultimo_contato
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const info = stmt.run(
        telefone,
        nome,
        JSON.stringify(familia),
        JSON.stringify(trabalho),
        JSON.stringify(jornada_espiritual),
        horario_preferido
    );

    return getUsuario(telefone);
}

/**
 * Update existing user
 * @param {string} telefone - Phone number
 * @param {object} updates - Fields to update
 * @returns {object} Updated user object
 */
export function updateUsuario(telefone, updates) {
    const usuario = getUsuario(telefone);
    if (!usuario) {
        throw new Error(`Usuario não encontrado: ${telefone}`);
    }

    const allowedFields = [
        'nome', 'familia', 'trabalho', 'jornada_espiritual',
        'proximo_followup', 'horario_preferido', 'ensinos_recentes',
        'ultimo_ensino_index', 'nivel', 'desafios_realizados'
    ];

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            setClauses.push(`${key} = ?`);

            // Stringify objects
            if (typeof value === 'object' && value !== null) {
                values.push(JSON.stringify(value));
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
}

/**
 * Add a conversation entry
 * @param {number} usuarioId - User ID
 * @param {string} mensagem - User message
 * @param {string} resposta - Bot response
 * @returns {object} Created conversation entry
 */
export function addConversa(usuarioId, mensagem, resposta = null) {
    const stmt = db.prepare(`
        INSERT INTO conversas (usuario_id, mensagem, resposta)
        VALUES (?, ?, ?)
    `);

    const info = stmt.run(usuarioId, mensagem, resposta);

    const getStmt = db.prepare('SELECT * FROM conversas WHERE id = ?');
    return getStmt.get(info.lastInsertRowid);
}

/**
 * Get conversation history for a user
 * @param {number} usuarioId - User ID
 * @param {number} limit - Maximum number of messages to retrieve (default: 50)
 * @returns {array} Array of conversation entries
 */
export function getHistorico(usuarioId, limit = 50) {
    const stmt = db.prepare(`
        SELECT * FROM conversas
        WHERE usuario_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    `);

    const conversas = stmt.all(usuarioId, limit);

    // Return in chronological order (oldest first)
    return conversas.reverse();
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
    const compareTime = beforeTime || new Date().toISOString();

    const stmt = db.prepare(`
        SELECT a.*, u.telefone, u.nome
        FROM agendamentos a
        JOIN usuarios u ON a.usuario_id = u.id
        WHERE a.enviado = 0 AND a.data_hora <= ?
        ORDER BY a.data_hora ASC
    `);

    return stmt.all(compareTime);
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
    addConversa,
    getHistorico,
    addAgendamento,
    getAgendamentosPendentes,
    marcarAgendamentoEnviado,
    closeDatabase,
    db
};
