/**
 * MongoDB State Manager - Sistema de Etapas com Embeddings
 * Jesus Cristo Bot - Estado Persistente + Busca Semântica
 *
 * Armazena estado de conversa no MongoDB com embeddings para
 * busca semântica de contexto e memória profunda.
 */

import { MongoClient } from 'mongodb';
import { GoogleGenAI } from '@google/genai';
import config, { MONGO_URL } from './config.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════

const EMBEDDING_MODEL = 'gemini-embedding-001';
const DB_NAME = 'jesus_bot';
const COLLECTION_STATE = 'conversa_estado';
const COLLECTION_MEMORY = 'conversa_memoria';
const COLLECTION_TOPICS = 'conversa_topicos';

let client = null;
let db = null;
let isConnected = false;

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

// ═══════════════════════════════════════════════════════════════
// CONEXÃO MONGODB
// ═══════════════════════════════════════════════════════════════

export async function connectMongo() {
    if (isConnected && client) return db;

    try {
        const mongoUrl = MONGO_URL || 'mongodb://localhost:27017';
        console.log('[MongoDB] Conectando a:', mongoUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

        client = new MongoClient(mongoUrl, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        await client.connect();
        db = client.db(DB_NAME);
        isConnected = true;

        // Cria índices
        await createIndexes();

        console.log('[MongoDB] Conectado com sucesso!');
        return db;
    } catch (error) {
        console.error('[MongoDB] Erro de conexão:', error.message);
        isConnected = false;
        throw error;
    }
}

async function createIndexes() {
    try {
        const stateCol = db.collection(COLLECTION_STATE);
        const memoryCol = db.collection(COLLECTION_MEMORY);
        const topicsCol = db.collection(COLLECTION_TOPICS);

        // Índices para estado de conversa
        await stateCol.createIndex({ jid: 1 }, { unique: true });
        await stateCol.createIndex({ etapa: 1 });
        await stateCol.createIndex({ ultimaInteracao: -1 });

        // Índices para memórias
        await memoryCol.createIndex({ jid: 1, timestamp: -1 });
        await memoryCol.createIndex({ jid: 1 });

        // Índices para tópicos (com embeddings)
        await topicsCol.createIndex({ jid: 1 });
        await topicsCol.createIndex({ topico: 1 });

        console.log('[MongoDB] Índices criados');
    } catch (error) {
        console.warn('[MongoDB] Erro ao criar índices:', error.message);
    }
}

export async function closeMongo() {
    if (client) {
        await client.close();
        isConnected = false;
        console.log('[MongoDB] Conexão fechada');
    }
}

// ═══════════════════════════════════════════════════════════════
// EMBEDDINGS
// ═══════════════════════════════════════════════════════════════

async function getEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
    try {
        const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            taskType: taskType,
            contents: [{ role: 'user', parts: [{ text: text.substring(0, 8000) }] }]
        });

        const embedding = result.embeddings?.[0]?.values || result.embedding?.values || null;
        if (!embedding || embedding.length === 0) {
            console.warn('[MongoDB:Embedding] Embedding vazio');
            return null;
        }
        return embedding;
    } catch (e) {
        console.error('[MongoDB:Embedding] Erro:', e.message);
        return null;
    }
}

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return magA && magB ? dotProduct / (magA * magB) : 0;
}

// ═══════════════════════════════════════════════════════════════
// ESTADO DE CONVERSA (CRUD)
// ═══════════════════════════════════════════════════════════════

/**
 * Busca estado de conversa pelo JID
 */
export async function getConversaEstado(jid) {
    try {
        if (!isConnected) await connectMongo();
        const col = db.collection(COLLECTION_STATE);
        return await col.findOne({ jid });
    } catch (error) {
        console.error('[MongoDB] Erro ao buscar estado:', error.message);
        return null;
    }
}

/**
 * Cria estado inicial de conversa
 */
export async function createConversaEstado(jid, nome = null) {
    try {
        if (!isConnected) await connectMongo();
        const col = db.collection(COLLECTION_STATE);

        const estado = {
            jid,
            etapa: 'primeiro_contato',
            mensagensTrocadas: 0,
            nomeUsuario: nome,
            jaSeApresentou: false,
            preferenciaTom: null,
            topicosPrincipais: [],
            emocoesDetectadas: [],
            ultimaInteracao: new Date(),
            criadoEm: new Date(),
            // Embeddings do contexto geral
            embeddingContexto: null,
            // Perfil resumido
            perfilResumo: {
                dorCentral: null,
                esperanca: null,
                estagioEspiritual: null,
                temasRecorrentes: []
            }
        };

        await col.insertOne(estado);
        console.log(`[MongoDB] Estado criado para: ${jid}`);
        return estado;
    } catch (error) {
        if (error.code === 11000) {
            // Já existe, retorna o existente
            return await getConversaEstado(jid);
        }
        console.error('[MongoDB] Erro ao criar estado:', error.message);
        return null;
    }
}

/**
 * Atualiza estado de conversa
 */
export async function updateConversaEstado(jid, updates) {
    try {
        if (!isConnected) await connectMongo();
        const col = db.collection(COLLECTION_STATE);

        // Garante que existe
        let estado = await getConversaEstado(jid);
        if (!estado) {
            estado = await createConversaEstado(jid);
        }

        // Campos permitidos
        const allowedFields = [
            'etapa', 'mensagensTrocadas', 'nomeUsuario', 'jaSeApresentou',
            'preferenciaTom', 'topicosPrincipais', 'emocoesDetectadas',
            'embeddingContexto', 'perfilResumo'
        ];

        const safeUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                safeUpdates[key] = value;
            }
        }

        safeUpdates.ultimaInteracao = new Date();

        await col.updateOne(
            { jid },
            { $set: safeUpdates }
        );

        return await getConversaEstado(jid);
    } catch (error) {
        console.error('[MongoDB] Erro ao atualizar estado:', error.message);
        return null;
    }
}

/**
 * Incrementa contador de mensagens
 */
export async function incrementarMensagens(jid) {
    try {
        if (!isConnected) await connectMongo();
        const col = db.collection(COLLECTION_STATE);

        await col.updateOne(
            { jid },
            {
                $inc: { mensagensTrocadas: 1 },
                $set: { ultimaInteracao: new Date() }
            }
        );

        return await getConversaEstado(jid);
    } catch (error) {
        console.error('[MongoDB] Erro ao incrementar:', error.message);
        return null;
    }
}

/**
 * Verifica e executa transição de etapa
 */
export async function checkEtapaTransition(jid) {
    try {
        if (!isConnected) await connectMongo();
        const estado = await getConversaEstado(jid);
        if (!estado) return null;

        const msgs = estado.mensagensTrocadas;
        const etapaAtual = estado.etapa;
        let novaEtapa = null;

        // Regras de transição
        if (msgs >= 20 && etapaAtual !== 'intimo') {
            novaEtapa = 'intimo';
        } else if (msgs >= 5 && etapaAtual === 'conhecendo') {
            novaEtapa = 'conversando';
        } else if (msgs >= 1 && etapaAtual === 'primeiro_contato') {
            novaEtapa = 'conhecendo';
        }

        if (novaEtapa) {
            await updateConversaEstado(jid, { etapa: novaEtapa });
            console.log(`[MongoDB] Transição: ${etapaAtual} → ${novaEtapa}`);
        }

        return novaEtapa;
    } catch (error) {
        console.error('[MongoDB] Erro na transição:', error.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// MEMÓRIAS COM EMBEDDINGS
// ═══════════════════════════════════════════════════════════════

/**
 * Salva memória de conversa com embedding
 */
export async function saveMemoria(jid, data) {
    try {
        if (!isConnected) await connectMongo();
        const col = db.collection(COLLECTION_MEMORY);

        const { userMessage, botResponse, emocao, topicos } = data;
        const resumo = `Pessoa: "${userMessage}" | Jesus: "${botResponse}"`;

        // Gera embedding da conversa
        const embedding = await getEmbedding(resumo);

        const memoria = {
            jid,
            resumo,
            userMessage,
            botResponse,
            emocao: emocao || null,
            topicos: topicos || [],
            embedding,
            timestamp: new Date()
        };

        await col.insertOne(memoria);

        // Atualiza tópicos do usuário
        if (topicos && topicos.length > 0) {
            await updateTopicosUsuario(jid, topicos, embedding);
        }

        // Limpa memórias antigas (mantém últimas 100)
        const count = await col.countDocuments({ jid });
        if (count > 100) {
            const oldest = await col.find({ jid })
                .sort({ timestamp: 1 })
                .limit(count - 100)
                .toArray();
            const idsToDelete = oldest.map(m => m._id);
            await col.deleteMany({ _id: { $in: idsToDelete } });
        }

        console.log(`[MongoDB] Memória salva para ${jid}`);
        return memoria;
    } catch (error) {
        console.error('[MongoDB] Erro ao salvar memória:', error.message);
        return null;
    }
}

/**
 * Busca memórias relevantes por similaridade semântica
 */
export async function getMemoriasRelevantes(jid, mensagemAtual, limite = 5) {
    try {
        if (!isConnected) await connectMongo();
        const col = db.collection(COLLECTION_MEMORY);

        // Gera embedding da mensagem atual
        const queryEmbedding = await getEmbedding(mensagemAtual, 'RETRIEVAL_QUERY');
        if (!queryEmbedding) {
            // Fallback: retorna últimas memórias
            return await col.find({ jid })
                .sort({ timestamp: -1 })
                .limit(limite)
                .toArray();
        }

        // Busca todas as memórias do usuário
        const todas = await col.find({ jid }).toArray();

        // Calcula similaridade
        const comScore = todas
            .filter(m => m.embedding && m.embedding.length > 0)
            .map(m => ({
                ...m,
                similaridade: cosineSimilarity(queryEmbedding, m.embedding)
            }))
            .sort((a, b) => b.similaridade - a.similaridade)
            .slice(0, limite)
            .filter(m => m.similaridade > 0.4);

        return comScore;
    } catch (error) {
        console.error('[MongoDB] Erro ao buscar memórias:', error.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// TÓPICOS COM EMBEDDINGS (MAPA DE INTERESSES)
// ═══════════════════════════════════════════════════════════════

/**
 * Atualiza tópicos do usuário com embeddings
 */
async function updateTopicosUsuario(jid, topicos, embedding) {
    try {
        const col = db.collection(COLLECTION_TOPICS);

        for (const topico of topicos) {
            await col.updateOne(
                { jid, topico: topico.toLowerCase() },
                {
                    $set: {
                        embedding,
                        ultimaOcorrencia: new Date()
                    },
                    $inc: { contagem: 1 },
                    $setOnInsert: {
                        jid,
                        topico: topico.toLowerCase(),
                        criadoEm: new Date()
                    }
                },
                { upsert: true }
            );
        }
    } catch (error) {
        console.warn('[MongoDB] Erro ao atualizar tópicos:', error.message);
    }
}

/**
 * Busca tópicos similares a uma mensagem
 */
export async function getTopicosSimilares(jid, mensagem, limite = 5) {
    try {
        if (!isConnected) await connectMongo();
        const col = db.collection(COLLECTION_TOPICS);

        const queryEmbedding = await getEmbedding(mensagem, 'RETRIEVAL_QUERY');
        if (!queryEmbedding) return [];

        const topicos = await col.find({ jid }).toArray();

        return topicos
            .filter(t => t.embedding && t.embedding.length > 0)
            .map(t => ({
                topico: t.topico,
                contagem: t.contagem,
                similaridade: cosineSimilarity(queryEmbedding, t.embedding)
            }))
            .sort((a, b) => b.similaridade - a.similaridade)
            .slice(0, limite)
            .filter(t => t.similaridade > 0.3);
    } catch (error) {
        console.error('[MongoDB] Erro ao buscar tópicos:', error.message);
        return [];
    }
}

/**
 * Retorna os tópicos mais frequentes do usuário
 */
export async function getTopicosFrequentes(jid, limite = 10) {
    try {
        if (!isConnected) await connectMongo();
        const col = db.collection(COLLECTION_TOPICS);

        return await col.find({ jid })
            .sort({ contagem: -1 })
            .limit(limite)
            .toArray();
    } catch (error) {
        console.error('[MongoDB] Erro ao buscar tópicos frequentes:', error.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// PERFIL SEMÂNTICO (ANÁLISE PROFUNDA)
// ═══════════════════════════════════════════════════════════════

/**
 * Atualiza o perfil semântico do usuário baseado nas conversas
 */
export async function atualizarPerfilSemantico(jid) {
    try {
        if (!isConnected) await connectMongo();
        const col = db.collection(COLLECTION_MEMORY);

        // Pega últimas 20 memórias
        const memorias = await col.find({ jid })
            .sort({ timestamp: -1 })
            .limit(20)
            .toArray();

        if (memorias.length < 3) return null;

        const historicoTexto = memorias.map(m => m.resumo).join('\n');

        // Usa Gemini para análise
        const prompt = `
        Analise este histórico de conversas e crie um Perfil Psicológico Espiritual profundo.

        Histórico:
        ${historicoTexto}

        Retorne APENAS JSON:
        {
            "dorCentral": "Qual a dor raiz? (Ex: Abandono, medo de falhar)",
            "esperanca": "O que ela busca?",
            "estagioEspiritual": "Iniciante / Cético / Ferido / Maduro",
            "temasRecorrentes": ["tema1", "tema2", "tema3"]
        }
        `;

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
        });

        // Handle different API response structures
        const responseText = result?.response?.text?.() ||
                             result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
                             null;
        if (!responseText) {
            console.warn('[MongoDB] No response text from Gemini for profile');
            return null;
        }
        const perfil = JSON.parse(responseText);

        // Gera embedding do perfil para busca semântica
        const perfilTexto = `${perfil.dorCentral} ${perfil.esperanca} ${perfil.temasRecorrentes.join(' ')}`;
        const embeddingContexto = await getEmbedding(perfilTexto);

        await updateConversaEstado(jid, {
            perfilResumo: perfil,
            embeddingContexto
        });

        console.log(`[MongoDB] Perfil semântico atualizado para ${jid}`);
        return perfil;
    } catch (error) {
        console.error('[MongoDB] Erro ao atualizar perfil:', error.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// CONTEXTO ENRIQUECIDO PARA GEMINI
// ═══════════════════════════════════════════════════════════════

/**
 * Monta contexto completo para o Gemini com embeddings
 */
export async function buildContextoCompleto(jid, mensagemAtual) {
    try {
        if (!isConnected) await connectMongo();

        // 1. Busca estado atual
        const estado = await getConversaEstado(jid);

        // 2. Busca memórias relevantes (semântico)
        const memorias = await getMemoriasRelevantes(jid, mensagemAtual, 4);

        // 3. Busca tópicos similares
        const topicos = await getTopicosSimilares(jid, mensagemAtual, 5);

        // 4. Monta contexto formatado
        let contexto = '';

        if (estado?.perfilResumo?.dorCentral) {
            contexto += `[PERFIL PROFUNDO]\n`;
            contexto += `Dor Central: ${estado.perfilResumo.dorCentral}\n`;
            contexto += `Busca: ${estado.perfilResumo.esperanca}\n`;
            contexto += `Estágio: ${estado.perfilResumo.estagioEspiritual}\n`;
            if (estado.perfilResumo.temasRecorrentes?.length > 0) {
                contexto += `Temas: ${estado.perfilResumo.temasRecorrentes.join(', ')}\n`;
            }
            contexto += '\n';
        }

        if (memorias.length > 0) {
            contexto += `[MEMÓRIAS RELEVANTES (por similaridade)]\n`;
            memorias.forEach(m => {
                const date = new Date(m.timestamp).toLocaleDateString('pt-BR');
                const score = (m.similaridade * 100).toFixed(0);
                contexto += `- [${score}% similar] (${date}): ${m.resumo.substring(0, 150)}...\n`;
            });
            contexto += '\n';
        }

        if (topicos.length > 0) {
            contexto += `[TÓPICOS DE INTERESSE]\n`;
            topicos.forEach(t => {
                contexto += `- ${t.topico} (mencionado ${t.contagem}x)\n`;
            });
            contexto += '\n';
        }

        return {
            estado,
            contexto,
            memorias,
            topicos
        };
    } catch (error) {
        console.error('[MongoDB] Erro ao montar contexto:', error.message);
        return { estado: null, contexto: '', memorias: [], topicos: [] };
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default {
    connectMongo,
    closeMongo,
    // Estado
    getConversaEstado,
    createConversaEstado,
    updateConversaEstado,
    incrementarMensagens,
    checkEtapaTransition,
    // Memórias
    saveMemoria,
    getMemoriasRelevantes,
    // Tópicos
    getTopicosSimilares,
    getTopicosFrequentes,
    // Perfil
    atualizarPerfilSemantico,
    // Contexto
    buildContextoCompleto
};
