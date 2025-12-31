/**
 * MongoDB Session Store for Baileys
 * Substitui useMultiFileAuthState para deploy no Scalingo
 *
 * Armazena credenciais do WhatsApp no MongoDB em vez do filesystem
 * Isso é necessário porque containers no Scalingo são efêmeros
 *
 * Variáveis de ambiente:
 * - SCALINGO_MONGO_URL (fornecida automaticamente pelo add-on)
 */

import { MongoClient } from 'mongodb';
import { proto } from '@whiskeysockets/baileys';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

// MongoDB connection
const MONGO_URL = process.env.SCALINGO_MONGO_URL || process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'jesus_bot';
const COLLECTION_NAME = 'baileys_auth';

let client = null;
let db = null;
let collection = null;

/**
 * Conecta ao MongoDB
 */
async function connectMongo() {
    if (client && client.topology?.isConnected()) {
        return { client, db, collection };
    }

    try {
        client = new MongoClient(MONGO_URL, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        await client.connect();
        db = client.db(DB_NAME);
        collection = db.collection(COLLECTION_NAME);

        // Criar índice único no campo 'key'
        await collection.createIndex({ key: 1 }, { unique: true });

        console.log('[SessionStore] MongoDB conectado com sucesso!');
        return { client, db, collection };
    } catch (error) {
        console.error('[SessionStore] Erro ao conectar MongoDB:', error.message);
        throw error;
    }
}

/**
 * Lê um valor do MongoDB
 * @param {string} key - Chave do documento
 * @returns {Promise<any>} - Valor armazenado ou null
 */
async function readData(key) {
    try {
        const { collection } = await connectMongo();
        const doc = await collection.findOne({ key });

        if (!doc) return null;

        return JSON.parse(doc.value, BufferJSON.reviver);
    } catch (error) {
        console.error(`[SessionStore] Erro ao ler ${key}:`, error.message);
        return null;
    }
}

/**
 * Escreve um valor no MongoDB
 * @param {string} key - Chave do documento
 * @param {any} value - Valor a ser armazenado
 */
async function writeData(key, value) {
    try {
        const { collection } = await connectMongo();
        const serialized = JSON.stringify(value, BufferJSON.replacer);

        await collection.updateOne(
            { key },
            {
                $set: {
                    key,
                    value: serialized,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
    } catch (error) {
        console.error(`[SessionStore] Erro ao escrever ${key}:`, error.message);
        throw error;
    }
}

/**
 * Remove um valor do MongoDB
 * @param {string} key - Chave do documento
 */
async function removeData(key) {
    try {
        const { collection } = await connectMongo();
        await collection.deleteOne({ key });
    } catch (error) {
        console.error(`[SessionStore] Erro ao remover ${key}:`, error.message);
    }
}

/**
 * useMongoAuthState - Substitui useMultiFileAuthState do Baileys
 * Armazena credenciais no MongoDB em vez do filesystem
 *
 * @param {string} sessionId - ID único da sessão (ex: 'jesus_bot_session')
 * @returns {Promise<{state: AuthenticationState, saveCreds: Function}>}
 */
export async function useMongoAuthState(sessionId = 'default') {
    const prefix = `session_${sessionId}_`;

    // Função para montar a chave
    const key = (type) => `${prefix}${type}`;

    // Lê credenciais existentes ou cria novas
    let creds = await readData(key('creds'));

    if (!creds) {
        creds = initAuthCreds();
        console.log('[SessionStore] Novas credenciais criadas');
    } else {
        console.log('[SessionStore] Credenciais carregadas do MongoDB');
    }

    // Função para salvar credenciais
    const saveCreds = async () => {
        await writeData(key('creds'), creds);
    };

    // Keys store
    const keys = {
        get: async (type, ids) => {
            const data = {};
            await Promise.all(
                ids.map(async (id) => {
                    let value = await readData(key(`${type}-${id}`));
                    if (value) {
                        if (type === 'app-state-sync-key') {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                })
            );
            return data;
        },
        set: async (data) => {
            const tasks = [];
            for (const category in data) {
                for (const id in data[category]) {
                    const value = data[category][id];
                    const keyName = key(`${category}-${id}`);

                    if (value) {
                        tasks.push(writeData(keyName, value));
                    } else {
                        tasks.push(removeData(keyName));
                    }
                }
            }
            await Promise.all(tasks);
        }
    };

    return {
        state: {
            creds,
            keys
        },
        saveCreds
    };
}

/**
 * Limpa todos os dados de sessão do MongoDB
 * @param {string} sessionId - ID da sessão
 */
export async function clearSession(sessionId = 'default') {
    try {
        const { collection } = await connectMongo();
        const prefix = `session_${sessionId}_`;

        const result = await collection.deleteMany({
            key: { $regex: `^${prefix}` }
        });

        console.log(`[SessionStore] Sessão ${sessionId} limpa. ${result.deletedCount} documentos removidos.`);
        return result.deletedCount;
    } catch (error) {
        console.error('[SessionStore] Erro ao limpar sessão:', error.message);
        return 0;
    }
}

/**
 * Verifica se uma sessão existe
 * @param {string} sessionId - ID da sessão
 * @returns {Promise<boolean>}
 */
export async function sessionExists(sessionId = 'default') {
    try {
        const creds = await readData(`session_${sessionId}_creds`);
        return creds !== null;
    } catch (error) {
        return false;
    }
}

/**
 * Lista todas as sessões armazenadas
 * @returns {Promise<string[]>} - Lista de IDs de sessão
 */
export async function listSessions() {
    try {
        const { collection } = await connectMongo();

        const docs = await collection
            .find({ key: { $regex: /^session_.*_creds$/ } })
            .toArray();

        return docs.map(doc => {
            const match = doc.key.match(/^session_(.+)_creds$/);
            return match ? match[1] : null;
        }).filter(Boolean);
    } catch (error) {
        console.error('[SessionStore] Erro ao listar sessões:', error.message);
        return [];
    }
}

/**
 * Health check do MongoDB
 */
export async function healthCheck() {
    try {
        const { db } = await connectMongo();
        await db.command({ ping: 1 });
        return { status: 'ok', database: DB_NAME };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
}

/**
 * Fecha conexão com MongoDB
 */
export async function closeConnection() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        collection = null;
        console.log('[SessionStore] Conexão MongoDB fechada');
    }
}

// Export default
export default {
    useMongoAuthState,
    clearSession,
    sessionExists,
    listSessions,
    healthCheck,
    closeConnection
};
