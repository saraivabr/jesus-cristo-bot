/**
 * Knowledge Base Module - RAG (Retrieval Augmented Generation)
 * Jesus Cristo Bot - Divine Communication System
 *
 * This module provides semantic search capabilities for gospel passages
 * and historical context using Gemini embeddings.
 *
 * Features:
 * - Load data from JSON files (evangelhos.json, contexto_historico.json)
 * - Generate embeddings using Gemini API (text-embedding-004)
 * - In-memory vector store with caching
 * - Semantic search using cosine similarity
 */

import { GoogleGenAI } from '@google/genai';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GEMINI_API_KEY } from './config.js';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Embedding model
const EMBEDDING_MODEL = 'text-embedding-004';

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY VECTOR STORE
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} DocumentEntry
 * @property {string} id - Unique identifier
 * @property {string} type - Type: 'passagem' | 'costume' | 'lugar' | 'festa' | 'grupo_social' | 'vida_cotidiana'
 * @property {string} titulo - Title
 * @property {string} texto - Full text content
 * @property {string} referencia - Biblical reference (for passages) or category
 * @property {string[]} temas - Related themes/keywords
 * @property {number[]} embedding - Vector embedding
 */

/** @type {DocumentEntry[]} */
const vectorStore = [];

/** @type {Map<string, number[]>} */
const embeddingCache = new Map();

/** @type {boolean} */
let isInitialized = false;

/** @type {boolean} */
let isInitializing = false;

// ═══════════════════════════════════════════════════════════════
// EMBEDDING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate embedding for a text using Gemini API
 * Uses cache to avoid regenerating embeddings for the same text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function getEmbedding(text) {
    if (!text || typeof text !== 'string') {
        console.error('[KnowledgeBase] Invalid text for embedding');
        return [];
    }

    // Normalize text for cache key
    const cacheKey = text.trim().toLowerCase().substring(0, 500);

    // Check cache first
    if (embeddingCache.has(cacheKey)) {
        return embeddingCache.get(cacheKey);
    }

    try {
        // Call Gemini embeddings API
        const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: [{ role: 'user', parts: [{ text: text.substring(0, 2000) }] }],
        });

        // Extract embedding values
        const embedding = result.embeddings?.[0]?.values || result.embedding?.values || [];

        if (embedding.length === 0) {
            console.warn('[KnowledgeBase] Empty embedding returned for text:', text.substring(0, 50));
            return [];
        }

        // Cache the embedding
        embeddingCache.set(cacheKey, embedding);

        return embedding;
    } catch (error) {
        console.error('[KnowledgeBase] Error generating embedding:', error.message);
        return [];
    }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} - Similarity score between -1 and 1
 */
export function cosineSimilarity(a, b) {
    if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (normA * normB);
}

// ═══════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════

/**
 * Load and process evangelhos.json
 * @returns {Promise<DocumentEntry[]>}
 */
async function loadEvangelhos() {
    const entries = [];

    try {
        const filePath = join(__dirname, 'data', 'evangelhos.json');
        const fileContent = await readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        if (!data.passagens || !Array.isArray(data.passagens)) {
            console.warn('[KnowledgeBase] No passages found in evangelhos.json');
            return entries;
        }

        console.log(`[KnowledgeBase] Loading ${data.passagens.length} passages from evangelhos.json`);

        for (const passagem of data.passagens) {
            // Create searchable text combining title, text, themes, and situacoes
            const situacoesText = passagem.situacoes?.join(', ') || '';
            const searchableText = `${passagem.titulo}. ${passagem.texto}. Temas: ${passagem.temas?.join(', ') || ''}. Situações: ${situacoesText}`;

            entries.push({
                id: passagem.id,
                type: 'passagem',
                titulo: passagem.titulo,
                texto: passagem.texto,
                referencia: passagem.referencia,
                livro: passagem.livro,
                temas: passagem.temas || [],
                situacoes: passagem.situacoes || [],
                conexao: passagem.conexao || null,
                curiosidade: passagem.curiosidade || null,
                searchableText,
                embedding: [], // Will be filled later
            });
        }

        console.log(`[KnowledgeBase] Loaded ${entries.length} passages`);
    } catch (error) {
        console.error('[KnowledgeBase] Error loading evangelhos.json:', error.message);
    }

    return entries;
}

/**
 * Load and process curiosidades.json
 * @returns {Promise<DocumentEntry[]>}
 */
async function loadCuriosidades() {
    const entries = [];

    try {
        const filePath = join(__dirname, 'data', 'curiosidades.json');
        const fileContent = await readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        if (!data.curiosidades || !Array.isArray(data.curiosidades)) {
            console.warn('[KnowledgeBase] No curiosidades found in curiosidades.json');
            return entries;
        }

        console.log(`[KnowledgeBase] Loading ${data.curiosidades.length} curiosidades from curiosidades.json`);

        for (const item of data.curiosidades) {
            // Create searchable text combining title, content, and triggers
            const searchableText = `${item.titulo}. ${item.conteudo}. Gatilhos: ${item.gatilhos?.join(', ') || ''}`;

            entries.push({
                id: item.id,
                type: 'curiosidade',
                titulo: item.titulo,
                texto: item.conteudo,
                referencia: item.passagem_relacionada || 'Curiosidade Histórica',
                temas: item.gatilhos || [],
                searchableText,
                embedding: [],
            });
        }

        console.log(`[KnowledgeBase] Loaded ${entries.length} curiosidades`);
    } catch (error) {
        // File might not exist yet, that's ok
        if (error.code !== 'ENOENT') {
            console.error('[KnowledgeBase] Error loading curiosidades.json:', error.message);
        } else {
            console.log('[KnowledgeBase] curiosidades.json not found, skipping');
        }
    }

    return entries;
}

/**
 * Load and process contexto_historico.json
 * @returns {Promise<DocumentEntry[]>}
 */
async function loadContextoHistorico() {
    const entries = [];

    try {
        const filePath = join(__dirname, 'data', 'contexto_historico.json');
        const fileContent = await readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        // Process costumes
        if (data.costumes && Array.isArray(data.costumes)) {
            console.log(`[KnowledgeBase] Loading ${data.costumes.length} customs from contexto_historico.json`);
            for (const item of data.costumes) {
                const searchableText = `${item.titulo}. ${item.conteudo}. Palavras-chave: ${item.palavras_chave?.join(', ') || ''}`;
                entries.push({
                    id: item.id,
                    type: 'costume',
                    titulo: item.titulo,
                    texto: item.conteudo,
                    referencia: 'Costumes e Tradições',
                    temas: item.palavras_chave || [],
                    searchableText,
                    embedding: [],
                });
            }
        }

        // Process lugares
        if (data.lugares && Array.isArray(data.lugares)) {
            console.log(`[KnowledgeBase] Loading ${data.lugares.length} places from contexto_historico.json`);
            for (const item of data.lugares) {
                const searchableText = `${item.titulo}. ${item.conteudo}. Palavras-chave: ${item.palavras_chave?.join(', ') || ''}`;
                entries.push({
                    id: item.id,
                    type: 'lugar',
                    titulo: item.titulo,
                    texto: item.conteudo,
                    referencia: 'Lugares Bíblicos',
                    temas: item.palavras_chave || [],
                    searchableText,
                    embedding: [],
                });
            }
        }

        // Process festas
        if (data.festas && Array.isArray(data.festas)) {
            console.log(`[KnowledgeBase] Loading ${data.festas.length} feasts from contexto_historico.json`);
            for (const item of data.festas) {
                const searchableText = `${item.titulo}. ${item.conteudo}. Palavras-chave: ${item.palavras_chave?.join(', ') || ''}`;
                entries.push({
                    id: item.id,
                    type: 'festa',
                    titulo: item.titulo,
                    texto: item.conteudo,
                    referencia: 'Festas Judaicas',
                    temas: item.palavras_chave || [],
                    searchableText,
                    embedding: [],
                });
            }
        }

        // Process grupos_sociais
        if (data.grupos_sociais && Array.isArray(data.grupos_sociais)) {
            console.log(`[KnowledgeBase] Loading ${data.grupos_sociais.length} social groups from contexto_historico.json`);
            for (const item of data.grupos_sociais) {
                const searchableText = `${item.titulo}. ${item.conteudo}. Palavras-chave: ${item.palavras_chave?.join(', ') || ''}`;
                entries.push({
                    id: item.id,
                    type: 'grupo_social',
                    titulo: item.titulo,
                    texto: item.conteudo,
                    referencia: 'Grupos Sociais',
                    temas: item.palavras_chave || [],
                    searchableText,
                    embedding: [],
                });
            }
        }

        // Process vida_cotidiana
        if (data.vida_cotidiana && Array.isArray(data.vida_cotidiana)) {
            console.log(`[KnowledgeBase] Loading ${data.vida_cotidiana.length} daily life items from contexto_historico.json`);
            for (const item of data.vida_cotidiana) {
                const searchableText = `${item.titulo}. ${item.conteudo}. Palavras-chave: ${item.palavras_chave?.join(', ') || ''}`;
                entries.push({
                    id: item.id,
                    type: 'vida_cotidiana',
                    titulo: item.titulo,
                    texto: item.conteudo,
                    referencia: 'Vida Cotidiana',
                    temas: item.palavras_chave || [],
                    searchableText,
                    embedding: [],
                });
            }
        }

        console.log(`[KnowledgeBase] Loaded ${entries.length} historical context entries`);
    } catch (error) {
        console.error('[KnowledgeBase] Error loading contexto_historico.json:', error.message);
    }

    return entries;
}

/**
 * Generate embeddings for all entries with rate limiting
 * @param {DocumentEntry[]} entries - Entries to process
 * @param {number} batchSize - Number of embeddings to generate in parallel
 * @param {number} delayMs - Delay between batches in milliseconds
 */
async function generateEmbeddingsForEntries(entries, batchSize = 5, delayMs = 100) {
    console.log(`[KnowledgeBase] Generating embeddings for ${entries.length} entries...`);

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);

        const promises = batch.map(async (entry) => {
            try {
                const embedding = await getEmbedding(entry.searchableText);
                entry.embedding = embedding;
                if (embedding.length > 0) {
                    processed++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`[KnowledgeBase] Failed to generate embedding for ${entry.id}:`, error.message);
                failed++;
            }
        });

        await Promise.all(promises);

        // Rate limiting delay between batches
        if (i + batchSize < entries.length && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // Progress logging every 10 entries
        if ((i + batchSize) % 10 === 0 || i + batchSize >= entries.length) {
            console.log(`[KnowledgeBase] Embedding progress: ${Math.min(i + batchSize, entries.length)}/${entries.length}`);
        }
    }

    console.log(`[KnowledgeBase] Embeddings generated: ${processed} successful, ${failed} failed`);
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize the knowledge base
 * Loads JSON files and generates embeddings on startup
 * @returns {Promise<boolean>} - Success status
 */
export async function initializeKnowledgeBase() {
    if (isInitialized) {
        console.log('[KnowledgeBase] Already initialized');
        return true;
    }

    if (isInitializing) {
        console.log('[KnowledgeBase] Initialization in progress, waiting...');
        // Wait for initialization to complete
        while (isInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return isInitialized;
    }

    isInitializing = true;
    console.log('[KnowledgeBase] Initializing knowledge base...');

    try {
        // Check if API key is available
        if (!GEMINI_API_KEY) {
            console.error('[KnowledgeBase] GEMINI_API_KEY not configured');
            isInitializing = false;
            return false;
        }

        // Load data from JSON files
        const [evangelhos, contexto, curiosidades] = await Promise.all([
            loadEvangelhos(),
            loadContextoHistorico(),
            loadCuriosidades(),
        ]);

        // Combine all entries
        const allEntries = [...evangelhos, ...contexto, ...curiosidades];

        if (allEntries.length === 0) {
            console.error('[KnowledgeBase] No entries loaded from JSON files');
            isInitializing = false;
            return false;
        }

        console.log(`[KnowledgeBase] Total entries loaded: ${allEntries.length}`);

        // Generate embeddings for all entries
        await generateEmbeddingsForEntries(allEntries);

        // Store in vector store (only entries with valid embeddings)
        vectorStore.length = 0; // Clear existing
        for (const entry of allEntries) {
            if (entry.embedding && entry.embedding.length > 0) {
                vectorStore.push(entry);
            }
        }

        console.log(`[KnowledgeBase] Vector store populated with ${vectorStore.length} entries`);
        isInitialized = true;
        isInitializing = false;

        return true;
    } catch (error) {
        console.error('[KnowledgeBase] Initialization failed:', error.message);
        isInitializing = false;
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// SEMANTIC SEARCH
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} SearchOptions
 * @property {number} [topK=5] - Number of results to return
 * @property {number} [minScore=0.3] - Minimum similarity score threshold
 * @property {string[]} [types] - Filter by document types
 * @property {string[]} [themes] - Filter by themes/keywords
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} id - Document ID
 * @property {string} type - Document type
 * @property {string} titulo - Title
 * @property {string} texto - Full text
 * @property {string} referencia - Biblical reference or category
 * @property {string[]} temas - Related themes
 * @property {number} score - Similarity score
 */

/**
 * Search for relevant passages using semantic similarity
 * @param {string} query - Search query
 * @param {SearchOptions} [options={}] - Search options
 * @returns {Promise<SearchResult[]>} - Array of relevant results
 */
export async function searchRelevantContext(query, options = {}) {
    const {
        topK = 5,
        minScore = 0.3,
        types = null,
        themes = null,
    } = options;

    if (!isInitialized) {
        console.warn('[KnowledgeBase] Not initialized, attempting initialization...');
        const success = await initializeKnowledgeBase();
        if (!success) {
            console.error('[KnowledgeBase] Failed to initialize, returning empty results');
            return [];
        }
    }

    if (!query || typeof query !== 'string') {
        console.warn('[KnowledgeBase] Invalid query');
        return [];
    }

    try {
        // Generate embedding for query
        const queryEmbedding = await getEmbedding(query);

        if (queryEmbedding.length === 0) {
            console.warn('[KnowledgeBase] Failed to generate query embedding');
            return [];
        }

        // Calculate similarity scores
        const results = [];

        for (const entry of vectorStore) {
            // Apply type filter
            if (types && types.length > 0 && !types.includes(entry.type)) {
                continue;
            }

            // Apply theme filter
            if (themes && themes.length > 0) {
                const hasMatchingTheme = entry.temas.some(t =>
                    themes.some(theme => t.toLowerCase().includes(theme.toLowerCase()))
                );
                if (!hasMatchingTheme) {
                    continue;
                }
            }

            // Calculate similarity
            const score = cosineSimilarity(queryEmbedding, entry.embedding);

            if (score >= minScore) {
                results.push({
                    id: entry.id,
                    type: entry.type,
                    titulo: entry.titulo,
                    texto: entry.texto,
                    referencia: entry.referencia,
                    livro: entry.livro || null,
                    temas: entry.temas,
                    situacoes: entry.situacoes || [],
                    conexao: entry.conexao || null,
                    curiosidade: entry.curiosidade || null,
                    score,
                });
            }
        }

        // Sort by score descending and take top K
        results.sort((a, b) => b.score - a.score);
        const topResults = results.slice(0, topK);

        console.log(`[KnowledgeBase] Search for "${query.substring(0, 50)}..." returned ${topResults.length} results`);

        if (topResults.length > 0) {
            console.log(`[KnowledgeBase] Top result: "${topResults[0].titulo}" (score: ${topResults[0].score.toFixed(3)})`);
        }

        return topResults;
    } catch (error) {
        console.error('[KnowledgeBase] Search error:', error.message);
        return [];
    }
}

/**
 * Format search results as context string for Gemini prompt
 * @param {SearchResult[]} results - Search results
 * @returns {string} - Formatted context string
 */
export function formatResultsAsContext(results) {
    if (!results || results.length === 0) {
        return '';
    }

    const parts = [];

    // Separate by type
    const passages = results.filter(r => r.type === 'passagem');
    const curiosidades = results.filter(r => r.type === 'curiosidade');
    const context = results.filter(r => !['passagem', 'curiosidade'].includes(r.type));

    if (passages.length > 0) {
        parts.push('[PASSAGENS BIBLICAS - USE A REFERÊNCIA AO CITAR]');
        for (const p of passages) {
            let entry = `- ${p.referencia}: "${p.texto.substring(0, 250)}${p.texto.length > 250 ? '...' : ''}"`;

            // Include conexao if available (for connecting user situation to story)
            if (p.conexao) {
                entry += `\n  [Conexão para usar]: "${p.conexao}"`;
            }

            // Include curiosidade if embedded in passage
            if (p.curiosidade) {
                entry += `\n  [Curiosidade]: ${p.curiosidade}`;
            }

            parts.push(entry);
        }
    }

    if (curiosidades.length > 0) {
        parts.push('\n[CURIOSIDADES HISTÓRICAS - USE NATURALMENTE]');
        for (const c of curiosidades) {
            parts.push(`- ${c.titulo}: ${c.texto}`);
            if (c.referencia && c.referencia !== 'Curiosidade Histórica') {
                parts.push(`  (Relacionado a: ${c.referencia})`);
            }
        }
    }

    if (context.length > 0) {
        parts.push('\n[CONTEXTO HISTÓRICO]');
        for (const c of context) {
            parts.push(`- ${c.titulo}: ${c.texto.substring(0, 150)}${c.texto.length > 150 ? '...' : ''}`);
        }
    }

    return parts.join('\n');
}

/**
 * Quick search by themes/keywords (faster, no embedding)
 * @param {string[]} keywords - Keywords to search for
 * @param {number} [limit=5] - Maximum results
 * @returns {SearchResult[]}
 */
export function searchByKeywords(keywords, limit = 5) {
    if (!keywords || keywords.length === 0) {
        return [];
    }

    const normalizedKeywords = keywords.map(k => k.toLowerCase().trim());
    const results = [];

    for (const entry of vectorStore) {
        const matchCount = entry.temas.filter(t =>
            normalizedKeywords.some(k => t.toLowerCase().includes(k))
        ).length;

        if (matchCount > 0) {
            results.push({
                id: entry.id,
                type: entry.type,
                titulo: entry.titulo,
                texto: entry.texto,
                referencia: entry.referencia,
                livro: entry.livro || null,
                temas: entry.temas,
                score: matchCount / normalizedKeywords.length,
            });
        }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get statistics about the knowledge base
 * @returns {Object} - Statistics
 */
export function getStats() {
    const stats = {
        isInitialized,
        totalEntries: vectorStore.length,
        cacheSize: embeddingCache.size,
        byType: {},
    };

    for (const entry of vectorStore) {
        stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
    }

    return stats;
}

/**
 * Clear the embedding cache
 */
export function clearCache() {
    embeddingCache.clear();
    console.log('[KnowledgeBase] Embedding cache cleared');
}

/**
 * Check if knowledge base is ready
 * @returns {boolean}
 */
export function isReady() {
    return isInitialized;
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════

export default {
    // Initialization
    initializeKnowledgeBase,
    isReady,

    // Embedding functions
    getEmbedding,
    cosineSimilarity,

    // Search functions
    searchRelevantContext,
    searchByKeywords,
    formatResultsAsContext,

    // Utility functions
    getStats,
    clearCache,
};
