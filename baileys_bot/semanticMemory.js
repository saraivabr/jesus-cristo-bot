/**
 * Semantic Memory Module
 * Jesus Cristo Bot - Conversation Memory with Embeddings
 *
 * This module provides semantic memory capabilities:
 * - Stores conversation summaries with vector embeddings per user
 * - Enables semantic search for relevant past conversations
 * - Auto-summarizes conversations after N messages
 *
 * Uses:
 * - Gemini text-embedding-004 for embeddings
 * - SQLite for persistent storage
 * - Cosine similarity for semantic search
 */

import { GoogleGenAI } from '@google/genai';
import config from './config.js';
import { db } from './database.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const EMBEDDING_MODEL = 'text-embedding-004';
const SUMMARY_MODEL = 'gemini-2.5-flash';
const MAX_MEMORIES_PER_USER = 50;
const AUTO_SUMMARIZE_THRESHOLD = 10; // Summarize every N messages

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

// ═══════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize the semantic memory table in SQLite
 */
function initSemanticMemoryTable() {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS semantic_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                jid TEXT NOT NULL,
                summary TEXT NOT NULL,
                user_message TEXT,
                bot_response TEXT,
                emotional_context TEXT,
                embedding TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_semantic_memories_jid ON semantic_memories(jid);
            CREATE INDEX IF NOT EXISTS idx_semantic_memories_timestamp ON semantic_memories(timestamp);
        `);

        // Message count tracking table for auto-summarization
        db.exec(`
            CREATE TABLE IF NOT EXISTS message_counts (
                jid TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                last_summary_at TEXT
            )
        `);

        console.log('[SemanticMemory] Database tables initialized');
    } catch (error) {
        console.error('[SemanticMemory] Error initializing tables:', error.message);
    }
}

// Initialize tables on module load
initSemanticMemoryTable();

// ═══════════════════════════════════════════════════════════════
// EMBEDDING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate embedding for text using Gemini text-embedding-004
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} Embedding vector
 */
async function getEmbedding(text) {
    try {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            console.warn('[SemanticMemory] Empty text provided for embedding');
            return null;
        }

        // Truncate very long texts (embedding model has limits)
        const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

        const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: [{ parts: [{ text: truncatedText }] }]
        });

        if (result && result.embeddings && result.embeddings.length > 0) {
            const embedding = result.embeddings[0].values;
            console.log(`[SemanticMemory] Generated embedding with ${embedding.length} dimensions`);
            return embedding;
        }

        // Alternative response structure
        if (result && result.embedding && result.embedding.values) {
            const embedding = result.embedding.values;
            console.log(`[SemanticMemory] Generated embedding with ${embedding.length} dimensions`);
            return embedding;
        }

        console.warn('[SemanticMemory] Unexpected embedding response structure');
        return null;
    } catch (error) {
        console.error('[SemanticMemory] Error generating embedding:', error.message);
        return null;
    }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} Cosine similarity score (0-1)
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
}

// ═══════════════════════════════════════════════════════════════
// CORE MEMORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Save a conversation summary with embedding
 * @param {string} jid - WhatsApp JID (user identifier)
 * @param {Object} data - Conversation data
 * @param {string} data.userMessage - User's message
 * @param {string} data.botResponse - Bot's response
 * @param {string} [data.timestamp] - ISO timestamp (defaults to now)
 * @param {Object} [data.emotionalContext] - Emotional context object
 * @returns {Promise<Object|null>} Saved memory object or null on failure
 */
async function saveConversationSummary(jid, data) {
    try {
        const { userMessage, botResponse, timestamp, emotionalContext } = data;

        if (!jid || !userMessage || !botResponse) {
            console.warn('[SemanticMemory] Missing required fields for saveConversationSummary');
            return null;
        }

        // Create summary text for embedding
        const summaryText = `Pessoa disse: "${userMessage}". Jesus respondeu: "${botResponse}"`;

        // Generate embedding
        const embedding = await getEmbedding(summaryText);
        if (!embedding) {
            console.error('[SemanticMemory] Failed to generate embedding, skipping save');
            return null;
        }

        // Prepare data
        const memoryTimestamp = timestamp || new Date().toISOString();
        const emotionalContextJson = emotionalContext
            ? JSON.stringify(emotionalContext)
            : null;
        const embeddingJson = JSON.stringify(embedding);

        // Check memory count and enforce limit
        await enforceMemoryLimit(jid);

        // Insert into database
        const stmt = db.prepare(`
            INSERT INTO semantic_memories
            (jid, summary, user_message, bot_response, emotional_context, embedding, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            jid,
            summaryText,
            userMessage,
            botResponse,
            emotionalContextJson,
            embeddingJson,
            memoryTimestamp
        );

        console.log(`[SemanticMemory] Saved memory for ${jid} (id: ${info.lastInsertRowid})`);

        // Update message count for auto-summarization
        await incrementMessageCount(jid);

        return {
            id: info.lastInsertRowid,
            jid,
            summary: summaryText,
            userMessage,
            botResponse,
            emotionalContext,
            timestamp: memoryTimestamp
        };
    } catch (error) {
        console.error('[SemanticMemory] Error saving conversation summary:', error.message);
        return null;
    }
}

/**
 * Find memories relevant to the current message using semantic similarity
 * @param {string} jid - WhatsApp JID
 * @param {string} currentMessage - Current user message to find relevant memories for
 * @param {number} [limit=3] - Maximum number of memories to return
 * @returns {Promise<Array>} Array of relevant memories sorted by similarity
 */
async function getRelevantMemories(jid, currentMessage, limit = 3) {
    try {
        if (!jid || !currentMessage) {
            console.warn('[SemanticMemory] Missing jid or currentMessage for getRelevantMemories');
            return [];
        }

        // Generate embedding for current message
        const queryEmbedding = await getEmbedding(currentMessage);
        if (!queryEmbedding) {
            console.warn('[SemanticMemory] Could not generate query embedding');
            return [];
        }

        // Fetch all memories for this user
        const stmt = db.prepare(`
            SELECT id, summary, user_message, bot_response, emotional_context, embedding, timestamp
            FROM semantic_memories
            WHERE jid = ?
            ORDER BY timestamp DESC
        `);

        const memories = stmt.all(jid);

        if (memories.length === 0) {
            console.log(`[SemanticMemory] No memories found for ${jid}`);
            return [];
        }

        // Calculate similarity for each memory
        const memoriesWithScores = memories.map(memory => {
            try {
                const memoryEmbedding = JSON.parse(memory.embedding);
                const similarity = cosineSimilarity(queryEmbedding, memoryEmbedding);

                return {
                    id: memory.id,
                    summary: memory.summary,
                    userMessage: memory.user_message,
                    botResponse: memory.bot_response,
                    emotionalContext: memory.emotional_context
                        ? JSON.parse(memory.emotional_context)
                        : null,
                    timestamp: memory.timestamp,
                    similarity
                };
            } catch (e) {
                console.warn(`[SemanticMemory] Error parsing memory ${memory.id}:`, e.message);
                return null;
            }
        }).filter(m => m !== null);

        // Sort by similarity (highest first) and take top N
        const relevantMemories = memoriesWithScores
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .filter(m => m.similarity > 0.3); // Only return memories with reasonable similarity

        console.log(`[SemanticMemory] Found ${relevantMemories.length} relevant memories for ${jid}`);

        if (relevantMemories.length > 0) {
            console.log(`[SemanticMemory] Top similarity score: ${relevantMemories[0].similarity.toFixed(3)}`);
        }

        return relevantMemories;
    } catch (error) {
        console.error('[SemanticMemory] Error getting relevant memories:', error.message);
        return [];
    }
}

/**
 * Summarize a conversation using Gemini
 * @param {string} jid - WhatsApp JID
 * @param {Array} messages - Array of message objects [{role: 'user'|'assistant', content: string}]
 * @returns {Promise<string|null>} Summary text or null on failure
 */
async function summarizeConversation(jid, messages) {
    try {
        if (!messages || messages.length === 0) {
            console.warn('[SemanticMemory] No messages to summarize');
            return null;
        }

        // Format messages for summarization
        const conversationText = messages.map(m => {
            const role = m.role === 'user' ? 'Pessoa' : 'Jesus';
            return `${role}: ${m.content}`;
        }).join('\n');

        const prompt = `Resuma esta conversa espiritual em 2-3 frases, capturando:
1. O tema principal ou necessidade da pessoa
2. A essência da orientação dada
3. O estado emocional percebido

Conversa:
${conversationText}

Resumo:`;

        const result = await ai.models.generateContent({
            model: SUMMARY_MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 256
            }
        });

        const summary = result.text || (result.response && result.response.text && result.response.text());

        if (summary && summary.trim()) {
            console.log(`[SemanticMemory] Generated summary for ${jid}: ${summary.substring(0, 100)}...`);
            return summary.trim();
        }

        return null;
    } catch (error) {
        console.error('[SemanticMemory] Error summarizing conversation:', error.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Enforce memory limit per user (keep only most recent N memories)
 * @param {string} jid - WhatsApp JID
 */
async function enforceMemoryLimit(jid) {
    try {
        const countStmt = db.prepare('SELECT COUNT(*) as count FROM semantic_memories WHERE jid = ?');
        const result = countStmt.get(jid);

        if (result && result.count >= MAX_MEMORIES_PER_USER) {
            // Delete oldest memories to make room
            const toDelete = result.count - MAX_MEMORIES_PER_USER + 1;
            const deleteStmt = db.prepare(`
                DELETE FROM semantic_memories
                WHERE id IN (
                    SELECT id FROM semantic_memories
                    WHERE jid = ?
                    ORDER BY timestamp ASC
                    LIMIT ?
                )
            `);
            deleteStmt.run(jid, toDelete);
            console.log(`[SemanticMemory] Deleted ${toDelete} old memories for ${jid} to enforce limit`);
        }
    } catch (error) {
        console.error('[SemanticMemory] Error enforcing memory limit:', error.message);
    }
}

/**
 * Increment message count and check for auto-summarization
 * @param {string} jid - WhatsApp JID
 */
async function incrementMessageCount(jid) {
    try {
        // Upsert message count
        const upsertStmt = db.prepare(`
            INSERT INTO message_counts (jid, count, last_summary_at)
            VALUES (?, 1, NULL)
            ON CONFLICT(jid) DO UPDATE SET count = count + 1
        `);
        upsertStmt.run(jid);

        // Check if threshold reached
        const countStmt = db.prepare('SELECT count, last_summary_at FROM message_counts WHERE jid = ?');
        const result = countStmt.get(jid);

        if (result && result.count >= AUTO_SUMMARIZE_THRESHOLD) {
            console.log(`[SemanticMemory] Auto-summarization threshold reached for ${jid}`);
            // Reset counter (actual summarization would be triggered externally)
            const resetStmt = db.prepare(`
                UPDATE message_counts
                SET count = 0, last_summary_at = ?
                WHERE jid = ?
            `);
            resetStmt.run(new Date().toISOString(), jid);
        }
    } catch (error) {
        console.error('[SemanticMemory] Error incrementing message count:', error.message);
    }
}

/**
 * Get message count for a user
 * @param {string} jid - WhatsApp JID
 * @returns {number} Current message count
 */
function getMessageCount(jid) {
    try {
        const stmt = db.prepare('SELECT count FROM message_counts WHERE jid = ?');
        const result = stmt.get(jid);
        return result ? result.count : 0;
    } catch (error) {
        console.error('[SemanticMemory] Error getting message count:', error.message);
        return 0;
    }
}

/**
 * Check if auto-summarization should be triggered
 * @param {string} jid - WhatsApp JID
 * @returns {boolean} True if summarization should be triggered
 */
function shouldAutoSummarize(jid) {
    const count = getMessageCount(jid);
    return count >= AUTO_SUMMARIZE_THRESHOLD;
}

/**
 * Get all memories for a user (for debugging/admin)
 * @param {string} jid - WhatsApp JID
 * @param {number} [limit=50] - Maximum memories to return
 * @returns {Array} Array of memory objects
 */
function getAllMemories(jid, limit = 50) {
    try {
        const stmt = db.prepare(`
            SELECT id, summary, user_message, bot_response, emotional_context, timestamp
            FROM semantic_memories
            WHERE jid = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `);

        const memories = stmt.all(jid, limit);

        return memories.map(m => ({
            id: m.id,
            summary: m.summary,
            userMessage: m.user_message,
            botResponse: m.bot_response,
            emotionalContext: m.emotional_context ? JSON.parse(m.emotional_context) : null,
            timestamp: m.timestamp
        }));
    } catch (error) {
        console.error('[SemanticMemory] Error getting all memories:', error.message);
        return [];
    }
}

/**
 * Delete all memories for a user
 * @param {string} jid - WhatsApp JID
 * @returns {number} Number of memories deleted
 */
function clearUserMemories(jid) {
    try {
        const stmt = db.prepare('DELETE FROM semantic_memories WHERE jid = ?');
        const result = stmt.run(jid);

        // Also reset message count
        const resetStmt = db.prepare('DELETE FROM message_counts WHERE jid = ?');
        resetStmt.run(jid);

        console.log(`[SemanticMemory] Cleared ${result.changes} memories for ${jid}`);
        return result.changes;
    } catch (error) {
        console.error('[SemanticMemory] Error clearing user memories:', error.message);
        return 0;
    }
}

/**
 * Get memory statistics
 * @returns {Object} Statistics object
 */
function getMemoryStats() {
    try {
        const totalStmt = db.prepare('SELECT COUNT(*) as total FROM semantic_memories');
        const usersStmt = db.prepare('SELECT COUNT(DISTINCT jid) as users FROM semantic_memories');

        const total = totalStmt.get();
        const users = usersStmt.get();

        return {
            totalMemories: total?.total || 0,
            uniqueUsers: users?.users || 0,
            maxPerUser: MAX_MEMORIES_PER_USER,
            autoSummarizeThreshold: AUTO_SUMMARIZE_THRESHOLD
        };
    } catch (error) {
        console.error('[SemanticMemory] Error getting stats:', error.message);
        return {
            totalMemories: 0,
            uniqueUsers: 0,
            maxPerUser: MAX_MEMORIES_PER_USER,
            autoSummarizeThreshold: AUTO_SUMMARIZE_THRESHOLD
        };
    }
}

/**
 * Format relevant memories for context injection into prompts
 * @param {Array} memories - Array of memory objects from getRelevantMemories
 * @returns {string} Formatted context string
 */
function formatMemoriesForContext(memories) {
    if (!memories || memories.length === 0) {
        return '';
    }

    const formatted = memories.map((m, i) => {
        const date = new Date(m.timestamp).toLocaleDateString('pt-BR');
        return `[Memória ${i + 1} - ${date}] ${m.summary}`;
    }).join('\n');

    return `[MEMÓRIAS RELEVANTES]\n${formatted}`;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export {
    saveConversationSummary,
    getRelevantMemories,
    summarizeConversation,
    getEmbedding,
    getAllMemories,
    clearUserMemories,
    getMemoryStats,
    formatMemoriesForContext,
    shouldAutoSummarize,
    getMessageCount,
    MAX_MEMORIES_PER_USER,
    AUTO_SUMMARIZE_THRESHOLD
};

export default {
    saveConversationSummary,
    getRelevantMemories,
    summarizeConversation,
    getEmbedding,
    getAllMemories,
    clearUserMemories,
    getMemoryStats,
    formatMemoriesForContext,
    shouldAutoSummarize,
    getMessageCount,
    MAX_MEMORIES_PER_USER,
    AUTO_SUMMARIZE_THRESHOLD
};
