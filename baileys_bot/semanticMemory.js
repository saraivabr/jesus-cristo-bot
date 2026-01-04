/**
 * Semantic Memory Module - Deep Soul Architecture
 * Jesus Cristo Bot - Advanced Memory System
 * 
 * ATUALIZADO: Implementa Perfil Psicológico Profundo e Memória Associativa.
 * Transforma o bot de um "respondendor" para um "confidente que lembra".
 */

import { GoogleGenAI } from '@google/genai';
import config from './config.js';
import { db } from './database.js';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const ANALYSIS_MODEL = 'gemini-2.5-flash';
const MAX_MEMORIES = 100; // Aumentado para permitir mais contexto

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

// ═══════════════════════════════════════════════════════════════
// DATABASE INIT (Expandido para Perfil Profundo)
// ═══════════════════════════════════════════════════════════════

function initSemanticMemoryTable() {
    try {
        // Tabela de memórias episódicas (fatos/conversas)
        db.exec(`
            CREATE TABLE IF NOT EXISTS semantic_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                jid TEXT NOT NULL,
                summary TEXT NOT NULL,
                concepts TEXT, -- JSON array de conceitos (ex: ["medo", "abandono"])
                embedding TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        `);

        // Tabela de Perfil Psicológico/Espiritual (A Alma do Usuário)
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_deep_profile (
                jid TEXT PRIMARY KEY,
                core_pain TEXT,        -- A dor central da pessoa
                core_hope TEXT,        -- O que ela mais deseja
                spiritual_stage TEXT,  -- Nível de maturidade
                key_relationships TEXT,-- JSON sobre família/amigos mencionados
                recurring_themes TEXT, -- Temas que sempre voltam
                last_updated TEXT
            )
        `);

        db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_jid ON semantic_memories(jid)`);
        console.log('[DeepMemory] Tables initialized for Deep Soul Architecture');
    } catch (error) {
        console.error('[DeepMemory] DB Error:', error.message);
    }
}

initSemanticMemoryTable();

// ═══════════════════════════════════════════════════════════════
// AI CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
    try {
        const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            taskType: taskType,
            contents: [{ role: 'user', parts: [{ text: text.substring(0, 8000) }] }]
        });

        // Handle both API response structures
        const embedding = result.embeddings?.[0]?.values || result.embedding?.values || null;

        if (!embedding || embedding.length === 0) {
            console.warn('[DeepMemory] Empty embedding returned');
            return null;
        }

        return embedding;
    } catch (e) {
        console.error(`[DeepMemory] Embedding error (type: ${taskType}):`, e.message);
        return null;
    }
}

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return magA && magB ? dotProduct / (magA * magB) : 0;
}

// ═══════════════════════════════════════════════════════════════
// DEEP PROFILE MANAGEMENT (A Alma)
// ═══════════════════════════════════════════════════════════════

/**
 * Atualiza o perfil profundo do usuário baseado nas conversas recentes
 */
async function updateDeepProfile(jid) {
    try {
        // Pega as últimas 20 memórias para análise
        const memories = db.prepare(`
            SELECT summary FROM semantic_memories 
            WHERE jid = ? ORDER BY timestamp DESC LIMIT 20
        `).all(jid);

        if (memories.length < 3) return; // Precisa de dados mínimos

        const historyText = memories.map(m => m.summary).join('\n');

        const prompt = `
        Analise este histórico de conversas e crie um Perfil Psicológico Espiritual profundo desta pessoa. 
        
        Histórico:
        ${historyText}
        
        Retorne APENAS um JSON:
        {
            "core_pain": "Qual a dor raiz? (Ex: Abandono paterno, medo de falhar)",
            "core_hope": "O que ela busca desesperadamente?",
            "spiritual_stage": "Iniciante / Cético / Ferido / Maduro",
            "key_relationships": "Resumo de quem importa (Ex: Mãe doente, filho rebelde)",
            "recurring_themes": "Padrões que se repetem (Ex: Culpa, Ansiedade financeira)"
        }
        `;

        const result = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
        });

        let profile;
        try {
            // Handle different API response structures
            const responseText = result?.response?.text?.() ||
                                 result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
                                 null;
            if (!responseText) {
                console.warn('[DeepMemory] No response text from Gemini');
                return;
            }
            profile = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[DeepMemory] Failed to parse profile JSON:', parseError.message);
            return;
        }

        db.prepare(`
            INSERT OR REPLACE INTO user_deep_profile 
            (jid, core_pain, core_hope, spiritual_stage, key_relationships, recurring_themes, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            jid,
            profile.core_pain,
            profile.core_hope,
            profile.spiritual_stage,
            profile.key_relationships,
            profile.recurring_themes,
            new Date().toISOString()
        );

        console.log(`[DeepMemory] Profile updated for ${jid}`);

    } catch (e) {
        console.error('[DeepMemory] Profile update failed:', e.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// MEMORY OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Salva memória e extrai conceitos automaticamente
 */
export async function saveConversationSummary(jid, data) {
    const { userMessage, botResponse, timestamp } = data;
    const summary = `Pessoa: "${userMessage}" | Jesus: "${botResponse}"`;
    
    // Gera embedding
    const embedding = await getEmbedding(summary, 'RETRIEVAL_DOCUMENT');
    if (!embedding) return null;

    // Salva
    db.prepare(`
        INSERT INTO semantic_memories (jid, summary, embedding, timestamp)
        VALUES (?, ?, ?, ?)
    `).run(jid, summary, JSON.stringify(embedding), timestamp || new Date().toISOString());

    // Trigger de atualização do perfil (a cada 5 mensagens aprox, simplificado aqui)
    if (Math.random() < 0.2) {
        updateDeepProfile(jid); // Roda em background
    }

    return true;
}

/**
 * Busca memórias relevantes + Perfil Profundo
 */
export async function getRelevantMemories(jid, currentMessage) {
    // 1. Busca Perfil Profundo (Contexto Global)
    const profile = db.prepare('SELECT * FROM user_deep_profile WHERE jid = ?').get(jid);
    
    // 2. Busca Memórias Episódicas (Contexto Específico)
    const queryEmbedding = await getEmbedding(currentMessage, 'RETRIEVAL_QUERY');
    let episodicMemories = [];

    if (queryEmbedding && queryEmbedding.length > 0) {
        const allMemories = db.prepare('SELECT summary, embedding, timestamp FROM semantic_memories WHERE jid = ?').all(jid);

        episodicMemories = allMemories
            .map(m => {
                try {
                    const embeddingVector = JSON.parse(m.embedding);
                    if (!embeddingVector || !Array.isArray(embeddingVector)) return null;
                    return {
                        ...m,
                        similarity: cosineSimilarity(queryEmbedding, embeddingVector)
                    };
                } catch (e) {
                    console.warn('[DeepMemory] Failed to parse embedding:', e.message);
                    return null;
                }
            })
            .filter(m => m !== null)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 4)
            .filter(m => m.similarity > 0.45);
    }

    return {
        profile,
        memories: episodicMemories
    };
}

/**
 * Formata para o Prompt do Sistema (A Mágica acontece aqui)
 */
export function formatMemoriesForContext(data) {
    if (!data) return '';
    const { profile, memories } = data;
    
    let context = '';

    if (profile) {
        context += `[PERFIL PROFUNDO DA ALMA]\n`;
        context += `Dor Central: ${profile.core_pain}\n`;
        context += `Busca: ${profile.core_hope}\n`;
        context += `Estágio: ${profile.spiritual_stage}\n`;
        context += `Relações: ${profile.key_relationships}\n`;
        context += `Padrões: ${profile.recurring_themes}\n\n`;
    }

    if (memories && memories.length > 0) {
        context += `[MEMÓRIAS RELEVANTES AO TEMA ATUAL]\n`;
        memories.forEach(m => {
            const date = new Date(m.timestamp).toLocaleDateString('pt-BR');
            context += `- (${date}): ${m.summary}\n`;
        });
    }

    return context;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export const shouldAutoSummarize = () => false; // Deprecated but kept for compatibility
export const getMessageCount = () => 0; // Deprecated

export default {
    saveConversationSummary,
    getRelevantMemories,
    formatMemoriesForContext
};