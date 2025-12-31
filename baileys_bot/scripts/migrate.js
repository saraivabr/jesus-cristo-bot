#!/usr/bin/env node
/**
 * Script de Migração SQLite -> PostgreSQL
 *
 * Uso: npm run migrate
 *
 * Este script:
 * 1. Conecta ao SQLite local (se existir)
 * 2. Conecta ao PostgreSQL do Scalingo
 * 3. Migra todos os dados
 */

import pg from 'pg';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SQLite path
const SQLITE_PATH = join(__dirname, '..', 'data', 'jesus.db');

// PostgreSQL URL
const PG_URL = process.env.SCALINGO_POSTGRESQL_URL || process.env.DATABASE_URL;

if (!PG_URL) {
    console.log('PostgreSQL URL não configurada. Pulando migração.');
    process.exit(0);
}

async function migrate() {
    console.log('═══════════════════════════════════════════════════');
    console.log('   MIGRAÇÃO SQLite -> PostgreSQL');
    console.log('═══════════════════════════════════════════════════');

    // Verifica se SQLite existe
    if (!existsSync(SQLITE_PATH)) {
        console.log('Banco SQLite não encontrado. Nada para migrar.');
        console.log('Inicializando PostgreSQL vazio...');

        const pool = new Pool({
            connectionString: PG_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Apenas inicializa as tabelas (o módulo databasePg.js faz isso)
        await pool.end();
        console.log('PostgreSQL pronto para uso!');
        return;
    }

    console.log(`SQLite encontrado em: ${SQLITE_PATH}`);

    // Conecta SQLite
    const sqlite = new Database(SQLITE_PATH, { readonly: true });
    console.log('SQLite conectado.');

    // Conecta PostgreSQL
    const pool = new Pool({
        connectionString: PG_URL,
        ssl: { rejectUnauthorized: false }
    });
    console.log('PostgreSQL conectado.');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ═══════════════════════════════════════════════════════════
        // CRIA TABELAS NO POSTGRES
        // ═══════════════════════════════════════════════════════════

        console.log('\n1. Criando tabelas no PostgreSQL...');

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

        await client.query(`
            CREATE TABLE IF NOT EXISTS conversas (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                mensagem TEXT NOT NULL,
                resposta TEXT,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

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

        console.log('   Tabelas criadas!');

        // ═══════════════════════════════════════════════════════════
        // MIGRA USUÁRIOS
        // ═══════════════════════════════════════════════════════════

        console.log('\n2. Migrando usuários...');

        const usuarios = sqlite.prepare('SELECT * FROM usuarios').all();
        console.log(`   Encontrados ${usuarios.length} usuários`);

        // Mapa de IDs antigos -> novos
        const userIdMap = new Map();

        for (const u of usuarios) {
            const result = await client.query(`
                INSERT INTO usuarios (
                    telefone, nome, familia, trabalho, jornada_espiritual,
                    ultimo_contato, proximo_followup, horario_preferido,
                    nivel, ensinos_recentes, ultimo_ensino_index,
                    desafios_realizados, video_boasvindas_enviado, criado_em
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome
                RETURNING id
            `, [
                u.telefone,
                u.nome,
                u.familia || '{}',
                u.trabalho || '{}',
                u.jornada_espiritual || '{}',
                u.ultimo_contato,
                u.proximo_followup,
                u.horario_preferido,
                u.nivel || 'curioso',
                u.ensinos_recentes || '[]',
                u.ultimo_ensino_index || 0,
                u.desafios_realizados || '[]',
                !!u.video_boasvindas_enviado,
                u.criado_em
            ]);

            userIdMap.set(u.id, result.rows[0].id);
        }
        console.log(`   ${usuarios.length} usuários migrados!`);

        // ═══════════════════════════════════════════════════════════
        // MIGRA CONVERSAS
        // ═══════════════════════════════════════════════════════════

        console.log('\n3. Migrando conversas...');

        const conversas = sqlite.prepare('SELECT * FROM conversas').all();
        console.log(`   Encontradas ${conversas.length} conversas`);

        for (const c of conversas) {
            const newUserId = userIdMap.get(c.usuario_id);
            if (!newUserId) continue;

            await client.query(`
                INSERT INTO conversas (usuario_id, mensagem, resposta, timestamp)
                VALUES ($1, $2, $3, $4)
            `, [newUserId, c.mensagem, c.resposta, c.timestamp]);
        }
        console.log(`   ${conversas.length} conversas migradas!`);

        // ═══════════════════════════════════════════════════════════
        // MIGRA AGENDAMENTOS
        // ═══════════════════════════════════════════════════════════

        console.log('\n4. Migrando agendamentos...');

        try {
            const agendamentos = sqlite.prepare('SELECT * FROM agendamentos').all();
            console.log(`   Encontrados ${agendamentos.length} agendamentos`);

            for (const a of agendamentos) {
                const newUserId = userIdMap.get(a.usuario_id);
                if (!newUserId) continue;

                await client.query(`
                    INSERT INTO agendamentos (usuario_id, tipo, data_hora, mensagem, enviado)
                    VALUES ($1, $2, $3, $4, $5)
                `, [newUserId, a.tipo, a.data_hora, a.mensagem, !!a.enviado]);
            }
            console.log(`   ${agendamentos.length} agendamentos migrados!`);
        } catch (e) {
            console.log('   Tabela de agendamentos não encontrada, pulando...');
        }

        // ═══════════════════════════════════════════════════════════
        // MIGRA MENSAGENS ENVIADAS
        // ═══════════════════════════════════════════════════════════

        console.log('\n5. Migrando mensagens enviadas...');

        try {
            const mensagens = sqlite.prepare('SELECT * FROM mensagens_enviadas').all();
            console.log(`   Encontradas ${mensagens.length} mensagens`);

            for (const m of mensagens) {
                const newUserId = userIdMap.get(m.usuario_id);
                if (!newUserId) continue;

                await client.query(`
                    INSERT INTO mensagens_enviadas (
                        usuario_id, message_key, jid, conteudo,
                        enviado_em, entregue_em, lido_em,
                        respondido, nudge_enviado, criado_em
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    newUserId, m.message_key, m.jid, m.conteudo,
                    m.enviado_em, m.entregue_em, m.lido_em,
                    !!m.respondido, !!m.nudge_enviado, m.criado_em
                ]);
            }
            console.log(`   ${mensagens.length} mensagens migradas!`);
        } catch (e) {
            console.log('   Tabela de mensagens não encontrada, pulando...');
        }

        // ═══════════════════════════════════════════════════════════
        // MIGRA MÉTRICAS
        // ═══════════════════════════════════════════════════════════

        console.log('\n6. Migrando métricas...');

        try {
            const metricas = sqlite.prepare('SELECT * FROM metricas_engajamento').all();
            console.log(`   Encontradas ${metricas.length} métricas`);

            for (const m of metricas) {
                const newUserId = userIdMap.get(m.usuario_id);
                if (!newUserId) continue;

                await client.query(`
                    INSERT INTO metricas_engajamento (
                        usuario_id, data, mensagens_enviadas, mensagens_lidas,
                        respostas_recebidas, nudges_enviados, nudges_respondidos,
                        tempo_medio_resposta
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (usuario_id, data) DO NOTHING
                `, [
                    newUserId, m.data,
                    m.mensagens_enviadas || 0, m.mensagens_lidas || 0,
                    m.respostas_recebidas || 0, m.nudges_enviados || 0,
                    m.nudges_respondidos || 0, m.tempo_medio_resposta
                ]);
            }
            console.log(`   ${metricas.length} métricas migradas!`);
        } catch (e) {
            console.log('   Tabela de métricas não encontrada, pulando...');
        }

        // Commit
        await client.query('COMMIT');

        console.log('\n═══════════════════════════════════════════════════');
        console.log('   MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
        console.log('═══════════════════════════════════════════════════\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\nERRO NA MIGRAÇÃO:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
        sqlite.close();
    }
}

// Executa migração
migrate().catch(err => {
    console.error('Falha na migração:', err);
    process.exit(1);
});
