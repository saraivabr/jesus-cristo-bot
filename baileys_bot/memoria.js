/**
 * Sistema de Memória para Jesus Bot
 * Gerencia extração de informações, detecção de humor e contexto
 * INTEGRADO com MCP Knowledge Graph Memory Server
 */

// ═══════════════════════════════════════════════════════════════
// INTEGRAÇÃO COM MCP KNOWLEDGE GRAPH
// ═══════════════════════════════════════════════════════════════

/**
 * Cache local do Knowledge Graph para operações síncronas
 * Sincronizado periodicamente com o MCP server
 */
const knowledgeGraphCache = {
    entities: new Map(),
    relations: [],
    lastSync: null
};

/**
 * Fila de operações pendentes para o MCP server
 * Processada de forma assíncrona
 */
const mcpOperationQueue = [];
let isProcessingQueue = false;

/**
 * Processa a fila de operações MCP de forma assíncrona
 */
async function processMcpQueue() {
    if (isProcessingQueue || mcpOperationQueue.length === 0) return;

    isProcessingQueue = true;

    while (mcpOperationQueue.length > 0) {
        const operation = mcpOperationQueue.shift();
        try {
            // As operações são armazenadas localmente e podem ser
            // sincronizadas com o MCP server quando disponível
            if (operation.type === 'create_entity') {
                knowledgeGraphCache.entities.set(operation.data.name, operation.data);
            } else if (operation.type === 'add_observation') {
                const entity = knowledgeGraphCache.entities.get(operation.entityName);
                if (entity) {
                    entity.observations = entity.observations || [];
                    entity.observations.push(...operation.observations);
                }
            } else if (operation.type === 'create_relation') {
                knowledgeGraphCache.relations.push(operation.data);
            }
        } catch (error) {
            console.error('[KnowledgeGraph] Erro ao processar operação:', error.message);
        }
    }

    isProcessingQueue = false;
}

/**
 * Cria entidade para um usuário no Knowledge Graph
 * @param {string} userId - ID do usuário (telefone/jid)
 * @param {Object} userData - Dados do usuário
 * @returns {Object} Entidade criada
 */
export function createUserEntity(userId, userData = {}) {
    try {
        if (!userId || typeof userId !== 'string') {
            console.warn('[KnowledgeGraph] userId invalido:', typeof userId);
            return null;
        }

        const safeUserData = userData && typeof userData === 'object' ? userData : {};
        const entityName = `user_${userId.replace(/[@.]/g, '_')}`;

        const observations = [];

        if (safeUserData.nome) {
            observations.push(`Nome: ${safeUserData.nome}`);
        }
        if (safeUserData.primeiroContato) {
            observations.push(`Primeiro contato em: ${new Date(safeUserData.primeiroContato).toLocaleDateString('pt-BR')}`);
        }
        if (safeUserData.trabalho) {
            observations.push(`Trabalho: ${safeUserData.trabalho}`);
        }
        if (safeUserData.localizacao) {
            observations.push(`Localizacao: ${safeUserData.localizacao}`);
        }

        const entity = {
            name: entityName,
            entityType: 'person',
            observations: observations,
            metadata: {
                userId: userId,
                createdAt: Date.now(),
                ...safeUserData
            }
        };

        // Adiciona ao cache local
        knowledgeGraphCache.entities.set(entityName, entity);

        // Enfileira para sincronizacao com MCP
        mcpOperationQueue.push({
            type: 'create_entity',
            data: entity
        });

        processMcpQueue();

        console.log(`[KnowledgeGraph] Entidade criada: ${entityName}`);
        return entity;
    } catch (error) {
        console.error('[KnowledgeGraph] Erro em createUserEntity:', error.message);
        return null;
    }
}

/**
 * Adiciona observação sobre um usuário
 * @param {string} userId - ID do usuário
 * @param {string|string[]} observation - Observação(ões) a adicionar
 * @returns {boolean} Sucesso da operação
 */
export function addUserObservation(userId, observation) {
    try {
        if (!userId || typeof userId !== 'string') {
            console.warn('[KnowledgeGraph] userId invalido em addUserObservation:', typeof userId);
            return false;
        }
        if (!observation) {
            console.warn('[KnowledgeGraph] observation invalida:', typeof observation);
            return false;
        }
        const entityName = `user_${userId.replace(/[@.]/g, '_')}`;
        const observations = Array.isArray(observation) ? observation : [observation];

        // Atualiza cache local
        let entity = knowledgeGraphCache.entities.get(entityName);

        if (!entity) {
            // Cria entidade se nao existir
            entity = createUserEntity(userId);
        }

        if (!entity) {
            console.warn('[KnowledgeGraph] Nao foi possivel criar/obter entidade para:', userId);
            return false;
        }

        // Evita duplicatas
        const existingObs = new Set(entity.observations || []);
        const newObs = observations.filter(obs => !existingObs.has(obs));

        if (newObs.length > 0) {
            entity.observations = [...(entity.observations || []), ...newObs];

            // Enfileira para sincronizacao
            mcpOperationQueue.push({
                type: 'add_observation',
                entityName: entityName,
                observations: newObs
            });

            processMcpQueue();

            console.log(`[KnowledgeGraph] Observacoes adicionadas para ${entityName}:`, newObs);
        }

        return true;
    } catch (error) {
        console.error('[KnowledgeGraph] Erro em addUserObservation:', error.message);
        return false;
    }
}

/**
 * Cria relacionamento entre usuários
 * @param {string} fromUser - ID do usuário origem
 * @param {string} toUser - ID do usuário destino
 * @param {string} type - Tipo do relacionamento
 * @returns {Object} Relacionamento criado
 */
export function createRelation(fromUser, toUser, type) {
    try {
        if (!fromUser || typeof fromUser !== 'string') {
            console.warn('[KnowledgeGraph] fromUser invalido:', typeof fromUser);
            return null;
        }
        if (!toUser || typeof toUser !== 'string') {
            console.warn('[KnowledgeGraph] toUser invalido:', typeof toUser);
            return null;
        }
        if (!type || typeof type !== 'string') {
            console.warn('[KnowledgeGraph] type invalido:', typeof type);
            return null;
        }

        const fromEntity = `user_${fromUser.replace(/[@.]/g, '_')}`;
        const toEntity = `user_${toUser.replace(/[@.]/g, '_')}`;

        const relation = {
            from: fromEntity,
            to: toEntity,
            relationType: type,
            createdAt: Date.now()
        };

        // Verifica se ja existe
        const exists = knowledgeGraphCache.relations.some(
            r => r.from === fromEntity && r.to === toEntity && r.relationType === type
        );

        if (!exists) {
            knowledgeGraphCache.relations.push(relation);

            mcpOperationQueue.push({
                type: 'create_relation',
                data: relation
            });

            processMcpQueue();

            console.log(`[KnowledgeGraph] Relacionamento criado: ${fromEntity} --[${type}]--> ${toEntity}`);
        }

        return relation;
    } catch (error) {
        console.error('[KnowledgeGraph] Erro em createRelation:', error.message);
        return null;
    }
}

/**
 * Busca no Knowledge Graph
 * @param {string} query - Termo de busca
 * @returns {Object} Resultados da busca
 */
export function searchMemory(query) {
    const emptyResults = {
        entities: [],
        observations: [],
        relations: []
    };

    try {
        if (!query || typeof query !== 'string') {
            console.warn('[KnowledgeGraph] query invalida em searchMemory:', typeof query);
            return emptyResults;
        }

        const queryLower = query.toLowerCase();
        const results = {
            entities: [],
            observations: [],
            relations: []
        };

        // Busca em entidades
        for (const [name, entity] of knowledgeGraphCache.entities) {
            let matched = false;

            // Busca no nome da entidade
            if (name && name.toLowerCase().includes(queryLower)) {
                matched = true;
            }

            // Busca nas observacoes
            const matchingObs = (entity?.observations || []).filter(
                obs => obs && typeof obs === 'string' && obs.toLowerCase().includes(queryLower)
            );

            if (matchingObs.length > 0) {
                matched = true;
                results.observations.push({
                    entity: name,
                    observations: matchingObs
                });
            }

            if (matched) {
                results.entities.push(entity);
            }
        }

        // Busca em relacionamentos
        results.relations = knowledgeGraphCache.relations.filter(
            rel => rel && rel.relationType && rel.from && rel.to &&
                   (rel.relationType.toLowerCase().includes(queryLower) ||
                    rel.from.toLowerCase().includes(queryLower) ||
                    rel.to.toLowerCase().includes(queryLower))
        );

        return results;
    } catch (error) {
        console.error('[KnowledgeGraph] Erro em searchMemory:', error.message);
        return emptyResults;
    }
}

/**
 * Obtém entidade do usuário do cache
 * @param {string} userId - ID do usuário
 * @returns {Object|null} Entidade ou null
 */
export function getUserEntity(userId) {
    try {
        if (!userId || typeof userId !== 'string') {
            return null;
        }
        const entityName = `user_${userId.replace(/[@.]/g, '_')}`;
        return knowledgeGraphCache.entities.get(entityName) || null;
    } catch (error) {
        console.error('[KnowledgeGraph] Erro em getUserEntity:', error.message);
        return null;
    }
}

/**
 * Obtém relacionamentos de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Array} Lista de relacionamentos
 */
export function getUserRelations(userId) {
    try {
        if (!userId || typeof userId !== 'string') {
            return [];
        }
        const entityName = `user_${userId.replace(/[@.]/g, '_')}`;
        return knowledgeGraphCache.relations.filter(
            rel => rel && (rel.from === entityName || rel.to === entityName)
        );
    } catch (error) {
        console.error('[KnowledgeGraph] Erro em getUserRelations:', error.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// EXTRAÇÃO DE INFORMAÇÕES (APRIMORADA)
// ═══════════════════════════════════════════════════════════════

/**
 * Extrai informações relevantes de uma mensagem do usuário
 * APRIMORADA: Detecta datas, pessoas importantes, promessas/compromissos
 * @param {string} mensagem - Mensagem recebida do usuário
 * @param {Object} perfilAtual - Perfil atual do usuário
 * @returns {Object} Informações extraídas
 */
export function extractInfo(mensagem, perfilAtual = {}) {
    // Validar entrada
    if (!mensagem || typeof mensagem !== 'string') {
        console.warn('[Memoria] mensagem inválida:', typeof mensagem);
        return { nome: null, familia: [], trabalho: null };
    }

    // Garantir perfilAtual é objeto
    const perfil = perfilAtual && typeof perfilAtual === 'object' ? perfilAtual : {};

    // Garantir familia é array
    const familiaAtual = Array.isArray(perfil.familia) ? [...perfil.familia] : [];
    const sentimentosAtuais = Array.isArray(perfil.sentimentos) ? [...perfil.sentimentos] : [];
    const hobbiesAtuais = Array.isArray(perfil.hobbies) ? [...perfil.hobbies] : [];
    const datasImportantesAtuais = Array.isArray(perfil.datasImportantes) ? [...perfil.datasImportantes] : [];
    const pessoasImportantesAtuais = Array.isArray(perfil.pessoasImportantes) ? [...perfil.pessoasImportantes] : [];
    const compromissosAtuais = Array.isArray(perfil.compromissos) ? [...perfil.compromissos] : [];

    const info = {
        nome: perfil.nome || null,
        familia: familiaAtual,
        trabalho: perfil.trabalho || null,
        sentimentos: sentimentosAtuais,
        hobbies: hobbiesAtuais,
        localizacao: perfil.localizacao || null,
        datasImportantes: datasImportantesAtuais,
        pessoasImportantes: pessoasImportantesAtuais,
        compromissos: compromissosAtuais
    };

    const msgLower = mensagem.toLowerCase();

    // ═══════════════════════════════════════════════════════════
    // EXTRAÇÃO DE NOME
    // ═══════════════════════════════════════════════════════════
    const nomePatterns = [
        /(?:meu nome (?:é|e)|me chamo|sou o|sou a|eu sou)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        /^(?:oi|olá|ola),?\s+(?:sou|eu sou)\s+(?:o|a)?\s*([a-záàâãéèêíïóôõöúçñ]+)/i
    ];
    for (const pattern of nomePatterns) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            info.nome = match[1].trim();
            break;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // EXTRAÇÃO DE FAMÍLIA
    // ═══════════════════════════════════════════════════════════
    const familiaKeywords = {
        esposa: /(?:minha esposa|minha mulher|esposa|mulher)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        marido: /(?:meu marido|marido)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        filho: /(?:meu filho|filho|meus filhos|filhos)(?:\s+(?:se chama|é|chama|são))?\s+([a-záàâãéèêíïóôõöúçñ\s,e]+)/i,
        filha: /(?:minha filha|filha|minhas filhas|filhas)(?:\s+(?:se chama|é|chama|são))?\s+([a-záàâãéèêíïóôõöúçñ\s,e]+)/i,
        mae: /(?:minha mãe|minha mae|mãe|mae)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        pai: /(?:meu pai|pai)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        irmao: /(?:meu irmão|meu irmao|irmão|irmao|irmãos|irmaos)\s+(?:se chama|é|chama|são)\s+([a-záàâãéèêíïóôõöúçñ\s,e]+)/i,
        irma: /(?:minha irmã|minha irma|irmã|irma|irmãs|irmas)\s+(?:se chama|é|chama|são)\s+([a-záàâãéèêíïóôõöúçñ\s,e]+)/i,
        avo: /(?:minha avó|minha avo|meu avô|meu avo|avó|avo|avô)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        neto: /(?:meu neto|neto|minha neta|neta)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        tio: /(?:meu tio|tio|minha tia|tia)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        primo: /(?:meu primo|primo|minha prima|prima)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        sogra: /(?:minha sogra|sogra|meu sogro|sogro)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i
    };

    for (const [tipo, pattern] of Object.entries(familiaKeywords)) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            const nomes = match[1].split(/,|\se\s/).map(n => n.trim());
            nomes.forEach(nome => {
                if (nome.length > 1) {
                    const jaExiste = info.familia.some(f => f.tipo === tipo && f.nome.toLowerCase() === nome.toLowerCase());
                    if (!jaExiste) {
                        info.familia.push({ tipo, nome });
                    }
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // EXTRAÇÃO DE TRABALHO
    // ═══════════════════════════════════════════════════════════
    const trabalhoPatterns = [
        /(?:trabalho como|sou|atuo como|profissão|trabalho de)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|no|na|em|$)/i,
        /(?:trabalho|emprego)\s+(?:na|no|em)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|como|$)/i
    ];
    for (const pattern of trabalhoPatterns) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            info.trabalho = match[1].trim();
            break;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // EXTRAÇÃO DE SENTIMENTOS E EMOÇÕES
    // ═══════════════════════════════════════════════════════════
    const sentimentoKeywords = {
        tristeza: ['triste', 'deprimido', 'depressão', 'melancolia', 'sozinho', 'vazio', 'perdido'],
        ansiedade: ['ansioso', 'ansiedade', 'preocupado', 'nervoso', 'estresse', 'estressado', 'angústia', 'angustiado'],
        alegria: ['feliz', 'alegre', 'contente', 'grato', 'abençoado', 'radiante', 'animado'],
        medo: ['medo', 'com medo', 'assustado', 'receio', 'temor', 'pavor'],
        raiva: ['raiva', 'irritado', 'com raiva', 'bravo', 'furioso', 'indignado'],
        esperanca: ['esperança', 'esperançoso', 'confiante', 'otimista', 'fé'],
        dor: ['dor', 'sofrimento', 'sofrendo', 'machucado', 'ferido', 'doente'],
        confusao: ['confuso', 'perdido', 'sem rumo', 'desorientado', 'não sei'],
        desespero: ['desespero', 'desesperado', 'sem saída', 'não aguento', 'fim', 'acabou'],
        luto: ['luto', 'perdi', 'faleceu', 'morreu', 'partiu', 'saudade', 'falta']
    };

    for (const [sentimento, keywords] of Object.entries(sentimentoKeywords)) {
        for (const keyword of keywords) {
            if (msgLower.includes(keyword)) {
                if (!info.sentimentos.includes(sentimento)) {
                    info.sentimentos.push(sentimento);
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // EXTRAÇÃO DE HOBBIES E INTERESSES
    // ═══════════════════════════════════════════════════════════
    const hobbiesPatterns = [
        /(?:gosto de|amo|adoro|curto)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|e|$)/i,
        /(?:hobby|hobbies|paixão|interesse)\s+(?:é|são|por)?\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|e|$)/i
    ];
    for (const pattern of hobbiesPatterns) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            const hobby = match[1].trim();
            if (hobby.length > 2 && !info.hobbies.includes(hobby)) {
                info.hobbies.push(hobby);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // EXTRAÇÃO DE LOCALIZAÇÃO
    // ═══════════════════════════════════════════════════════════
    const localizacaoPatterns = [
        /(?:moro em|vivo em|sou de|da cidade de|da)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|$)/i,
        /(?:aqui em|aqui no|aqui na)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|$)/i
    ];
    for (const pattern of localizacaoPatterns) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            info.localizacao = match[1].trim();
            break;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // NOVO: EXTRAÇÃO DE DATAS IMPORTANTES
    // Aniversários, eventos, datas comemorativas
    // ═══════════════════════════════════════════════════════════
    const datasPatterns = [
        // Aniversário próprio
        /(?:meu aniversário|faço aniversário|nasci)\s+(?:é|em|no dia|dia)\s+(\d{1,2})\s*(?:de|\/)\s*(\w+|\d{1,2})/i,
        // Aniversário de alguém
        /(?:aniversário\s+d[oea]\s+(\w+))\s+(?:é|em|no dia)\s+(\d{1,2})\s*(?:de|\/)\s*(\w+|\d{1,2})/i,
        // Casamento
        /(?:casei|casamento|me casei)\s+(?:em|no dia|dia)\s+(\d{1,2})\s*(?:de|\/)\s*(\w+|\d{1,2})(?:\s*(?:de|\/)\s*(\d{2,4}))?/i,
        // Data genérica importante
        /(?:data importante|dia especial|não posso esquecer)\s+(?:é|em|no dia)\s+(\d{1,2})\s*(?:de|\/)\s*(\w+|\d{1,2})/i,
        // Eventos futuros
        /(?:vou|tenho|vai ter)\s+(?:\w+\s+)?(?:dia|em|no dia)\s+(\d{1,2})\s*(?:de|\/)\s*(\w+|\d{1,2})/i
    ];

    const mesesMap = {
        'janeiro': 1, 'jan': 1, '01': 1, '1': 1,
        'fevereiro': 2, 'fev': 2, '02': 2, '2': 2,
        'março': 3, 'mar': 3, '03': 3, '3': 3,
        'abril': 4, 'abr': 4, '04': 4, '4': 4,
        'maio': 5, 'mai': 5, '05': 5, '5': 5,
        'junho': 6, 'jun': 6, '06': 6, '6': 6,
        'julho': 7, 'jul': 7, '07': 7, '7': 7,
        'agosto': 8, 'ago': 8, '08': 8, '8': 8,
        'setembro': 9, 'set': 9, '09': 9, '9': 9,
        'outubro': 10, 'out': 10, '10': 10,
        'novembro': 11, 'nov': 11, '11': 11,
        'dezembro': 12, 'dez': 12, '12': 12
    };

    // Extração de aniversário próprio
    const aniversarioMatch = mensagem.match(/(?:meu aniversário|faço aniversário|nasci)\s+(?:é|em|no dia|dia)\s+(\d{1,2})\s*(?:de|\/)\s*(\w+|\d{1,2})/i);
    if (aniversarioMatch) {
        const dia = parseInt(aniversarioMatch[1]);
        const mesStr = aniversarioMatch[2].toLowerCase();
        const mes = mesesMap[mesStr] || parseInt(mesStr);
        if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
            const dataEvento = {
                tipo: 'aniversario_proprio',
                dia: dia,
                mes: mes,
                descricao: 'Aniversário',
                detectadoEm: Date.now()
            };
            const jaExiste = info.datasImportantes.some(d => d.tipo === 'aniversario_proprio');
            if (!jaExiste) {
                info.datasImportantes.push(dataEvento);
            }
        }
    }

    // Extração de aniversário de familiares
    const anivFamiliarMatch = mensagem.match(/aniversário\s+d[oea]\s+(\w+)\s+(?:é|em|no dia)\s+(\d{1,2})\s*(?:de|\/)\s*(\w+|\d{1,2})/i);
    if (anivFamiliarMatch) {
        const pessoa = anivFamiliarMatch[1];
        const dia = parseInt(anivFamiliarMatch[2]);
        const mesStr = anivFamiliarMatch[3].toLowerCase();
        const mes = mesesMap[mesStr] || parseInt(mesStr);
        if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
            const dataEvento = {
                tipo: 'aniversario_familiar',
                pessoa: pessoa,
                dia: dia,
                mes: mes,
                descricao: `Aniversário de ${pessoa}`,
                detectadoEm: Date.now()
            };
            const jaExiste = info.datasImportantes.some(d =>
                d.tipo === 'aniversario_familiar' && d.pessoa?.toLowerCase() === pessoa.toLowerCase()
            );
            if (!jaExiste) {
                info.datasImportantes.push(dataEvento);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // NOVO: EXTRAÇÃO DE PESSOAS IMPORTANTES
    // Amigos, chefe, pastor, pessoas mencionadas frequentemente
    // ═══════════════════════════════════════════════════════════
    const pessoasPatterns = [
        // Amigos
        /(?:meu amigo|minha amiga|melhor amigo|melhor amiga)\s+(?:se chama|é|chama)?\s*([a-záàâãéèêíïóôõöúçñ]+)/i,
        // Chefe/trabalho
        /(?:meu chefe|minha chefe|meu patrão|minha patroa|meu gestor|minha gestora)\s+(?:se chama|é|chama)?\s*([a-záàâãéèêíïóôõöúçñ]+)/i,
        // Pastor/líder espiritual
        /(?:meu pastor|minha pastora|padre|meu padre|nosso pastor|nossa pastora)\s+(?:se chama|é|chama)?\s*([a-záàâãéèêíïóôõöúçñ]+)/i,
        // Namorado/namorada
        /(?:meu namorado|minha namorada|meu noivo|minha noiva)\s+(?:se chama|é|chama)?\s*([a-záàâãéèêíïóôõöúçñ]+)/i,
        // Professor/mentor
        /(?:meu professor|minha professora|meu mentor|minha mentora)\s+(?:se chama|é|chama)?\s*([a-záàâãéèêíïóôõöúçñ]+)/i,
        // Médico/terapeuta
        /(?:meu médico|minha médica|meu psicólogo|minha psicóloga|meu terapeuta)\s+(?:se chama|é|chama)?\s*([a-záàâãéèêíïóôõöúçñ]+)/i
    ];

    const tiposRelacao = [
        { pattern: /(?:meu amigo|minha amiga|melhor amigo|melhor amiga)/i, tipo: 'amigo' },
        { pattern: /(?:meu chefe|minha chefe|meu patrão|minha patroa|meu gestor|minha gestora)/i, tipo: 'chefe' },
        { pattern: /(?:meu pastor|minha pastora|padre|meu padre)/i, tipo: 'lider_espiritual' },
        { pattern: /(?:meu namorado|minha namorada|meu noivo|minha noiva)/i, tipo: 'relacionamento' },
        { pattern: /(?:meu professor|minha professora|meu mentor|minha mentora)/i, tipo: 'mentor' },
        { pattern: /(?:meu médico|minha médica|meu psicólogo|minha psicóloga|meu terapeuta)/i, tipo: 'saude' }
    ];

    for (const { pattern: tipoPattern, tipo } of tiposRelacao) {
        const fullPattern = new RegExp(tipoPattern.source + /\s+(?:se chama|é|chama)?\s*([a-záàâãéèêíïóôõöúçñ]+)/i.source, 'i');
        const match = mensagem.match(fullPattern);
        if (match && match[1]) {
            const nome = match[1].trim();
            if (nome.length > 1) {
                const jaExiste = info.pessoasImportantes.some(p =>
                    p.nome.toLowerCase() === nome.toLowerCase() && p.tipo === tipo
                );
                if (!jaExiste) {
                    info.pessoasImportantes.push({
                        nome: nome,
                        tipo: tipo,
                        detectadoEm: Date.now()
                    });
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // NOVO: EXTRAÇÃO DE COMPROMISSOS/PROMESSAS
    // Detecta quando usuário faz promessas ou compromissos
    // ═══════════════════════════════════════════════════════════
    const compromissosPatterns = [
        // Promessas diretas
        { pattern: /(?:vou|irei)\s+(orar|rezar|jejuar|ler a bíblia|meditar|agradecer)/i, tipo: 'promessa_espiritual' },
        { pattern: /(?:vou|irei)\s+(tentar|fazer|mudar|melhorar)\s+(.+?)(?:\.|,|!|$)/i, tipo: 'promessa_mudanca' },
        { pattern: /(?:prometo|me comprometo|vou me esforçar)\s+(?:a\s+)?(.+?)(?:\.|,|!|$)/i, tipo: 'promessa_formal' },
        // Intenções
        { pattern: /(?:quero|preciso|tenho que|devo)\s+(parar de|deixar de|começar a)\s+(.+?)(?:\.|,|!|$)/i, tipo: 'intencao' },
        // Decisões
        { pattern: /(?:decidi|resolvi|vou)\s+(perdoar|reconciliar|conversar|pedir desculpas)/i, tipo: 'decisao_relacional' },
        // Metas espirituais
        { pattern: /(?:vou|quero)\s+(?:ir\s+)?(?:na|à|a)\s+(igreja|missa|culto|célula)/i, tipo: 'compromisso_igreja' }
    ];

    for (const { pattern, tipo } of compromissosPatterns) {
        const match = mensagem.match(pattern);
        if (match) {
            const descricao = match[0].trim();
            const jaExiste = info.compromissos.some(c =>
                c.descricao.toLowerCase() === descricao.toLowerCase()
            );
            if (!jaExiste) {
                info.compromissos.push({
                    tipo: tipo,
                    descricao: descricao,
                    detectadoEm: Date.now(),
                    status: 'pendente',
                    followUp: true
                });
            }
        }
    }

    return info;
}

// ═══════════════════════════════════════════════════════════════
// CONSTRUÇÃO DE CONTEXTO (APRIMORADA)
// ═══════════════════════════════════════════════════════════════

/**
 * Constrói contexto personalizado para o Gemini baseado no perfil do usuário
 * APRIMORADO: Inclui dados do Knowledge Graph e histórico rico
 * @param {Object} perfil - Perfil do usuário com informações coletadas
 * @param {boolean} isFirstContact - Se é o primeiro contato
 * @returns {string} Contexto formatado para o Gemini
 */
export function buildContext(perfil, isFirstContact = false) {
    try {
        const partes = [];

        // Safe access com optional chaining e fallbacks
        const nome = perfil?.nome || 'Pessoa';
        const familia = Array.isArray(perfil?.familia) ? perfil.familia : [];
        const trabalho = typeof perfil?.trabalho === 'object' ? perfil.trabalho : (perfil?.trabalho || null);
        const jornadaEspiritual = typeof perfil?.jornada_espiritual === 'object' ? perfil.jornada_espiritual : {};
        const localizacao = perfil?.localizacao || null;
        const hobbies = Array.isArray(perfil?.hobbies) ? perfil.hobbies : [];
        const sentimentos = Array.isArray(perfil?.sentimentos) ? perfil.sentimentos : [];
        const datasImportantes = Array.isArray(perfil?.datasImportantes) ? perfil.datasImportantes : [];
        const pessoasImportantes = Array.isArray(perfil?.pessoasImportantes) ? perfil.pessoasImportantes : [];
        const compromissos = Array.isArray(perfil?.compromissos) ? perfil.compromissos : [];

        // ═══════════════════════════════════════════════════════════
        // DADOS BÁSICOS DO PERFIL
        // ═══════════════════════════════════════════════════════════
        if (perfil?.nome) {
            partes.push(`Nome: ${nome}`);
        }

        // Validar cada item da família antes de usar
        if (familia.length > 0) {
            const familiaValida = familia.filter(f => f && typeof f === 'object' && f.tipo && f.nome);
            if (familiaValida.length > 0) {
                const familiaTexto = familiaValida.map(f => `${f.tipo}: ${f.nome}`).join(', ');
                partes.push(`Família: ${familiaTexto}`);
            }
        }

        if (trabalho) {
            partes.push(`Trabalho: ${typeof trabalho === 'object' ? JSON.stringify(trabalho) : trabalho}`);
        }

        if (localizacao) {
            partes.push(`Localização: ${localizacao}`);
        }

        if (hobbies.length > 0) {
            partes.push(`Interesses: ${hobbies.join(', ')}`);
        }

        if (sentimentos.length > 0) {
            partes.push(`Estado emocional atual: ${sentimentos.join(', ')}`);
        }

        // ═══════════════════════════════════════════════════════════
        // NOVO: DATAS IMPORTANTES
        // ═══════════════════════════════════════════════════════════
        if (datasImportantes.length > 0) {
            const hoje = new Date();
            const mesAtual = hoje.getMonth() + 1;
            const diaAtual = hoje.getDate();

            const datasProximas = datasImportantes.filter(d => {
                // Validar que d é um objeto válido com as propriedades necessárias
                if (!d || typeof d !== 'object' || typeof d.dia !== 'number' || typeof d.mes !== 'number') {
                    return false;
                }
                // Verifica se a data está próxima (mesma semana ou próximos 7 dias)
                const diffDias = (d.mes === mesAtual) ? d.dia - diaAtual :
                                 (d.mes === mesAtual + 1 && d.dia <= 7) ? 30 - diaAtual + d.dia : -1;
                return diffDias >= 0 && diffDias <= 7;
            });

            if (datasProximas.length > 0) {
                const datasTexto = datasProximas.map(d =>
                    `${d.descricao || 'Evento'} (dia ${d.dia}/${d.mes})`
                ).join(', ');
                partes.push(`DATAS PROXIMAS: ${datasTexto}`);
            }

            // Verifica se hoje é alguma data especial
            const dataHoje = datasImportantes.find(d =>
                d && typeof d === 'object' && d.dia === diaAtual && d.mes === mesAtual
            );
            if (dataHoje && dataHoje.descricao) {
                partes.push(`HOJE E ${dataHoje.descricao.toUpperCase()}!`);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // NOVO: PESSOAS IMPORTANTES
        // ═══════════════════════════════════════════════════════════
        if (pessoasImportantes.length > 0) {
            const pessoasValidas = pessoasImportantes.filter(p => p && typeof p === 'object' && p.nome && p.tipo);
            if (pessoasValidas.length > 0) {
                const pessoasTexto = pessoasValidas.map(p =>
                    `${p.nome} (${p.tipo})`
                ).join(', ');
                partes.push(`Pessoas importantes: ${pessoasTexto}`);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // NOVO: COMPROMISSOS PENDENTES (para follow-up)
        // ═══════════════════════════════════════════════════════════
        if (compromissos.length > 0) {
            const compromissosPendentes = compromissos.filter(c => c && typeof c === 'object' && c.status === 'pendente');
            if (compromissosPendentes.length > 0) {
                const compromissosTexto = compromissosPendentes.slice(0, 3).map(c => {
                    const diasAtras = Math.floor((Date.now() - (c.detectadoEm || Date.now())) / (1000 * 60 * 60 * 24));
                    return `"${c.descricao || 'Compromisso'}" (ha ${diasAtras} dia${diasAtras !== 1 ? 's' : ''})`;
                }).join('; ');
                partes.push(`COMPROMISSOS FEITOS: ${compromissosTexto} - Pergunte gentilmente como esta indo!`);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // ANÁLISE DE TEMPO DESDE ÚLTIMO CONTATO
        // ═══════════════════════════════════════════════════════════
        if (perfil?.ultimoContato && !isFirstContact) {
            try {
                const ultimoContatoDate = new Date(perfil.ultimoContato);
                const agora = new Date();
                const diffMs = agora - ultimoContatoDate;
                const diasDesde = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const horasDesde = Math.floor(diffMs / (1000 * 60 * 60));

                if (diasDesde >= 7) {
                    partes.push(`RETORNO APOS ${diasDesde} DIAS - Demonstre alegria em ve-lo(a) de volta!`);
                } else if (diasDesde >= 3) {
                    partes.push(`Ultimo contato: ha ${diasDesde} dias`);
                } else if (horasDesde >= 24) {
                    partes.push(`Ultimo contato: ontem`);
                }
            } catch (dateError) {
                console.warn('[Memoria] Erro ao processar data de ultimo contato:', dateError.message);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // CONTEXTO DO KNOWLEDGE GRAPH
        // ═══════════════════════════════════════════════════════════
        if (perfil?.telefone) {
            try {
                const userEntity = getUserEntity(perfil.telefone);
                if (userEntity && userEntity.observations && userEntity.observations.length > 0) {
                    // Pega as observações mais recentes (últimas 5)
                    const obsRecentes = userEntity.observations.slice(-5);
                    partes.push(`Observacoes anteriores: ${obsRecentes.join(' | ')}`);
                }

                // Relacionamentos
                const relations = getUserRelations(perfil.telefone);
                if (relations && relations.length > 0) {
                    const refRelations = relations.filter(r => r && r.relationType === 'indicou');
                    if (refRelations.length > 0) {
                        partes.push(`Esta pessoa ja indicou ${refRelations.length} pessoa(s) para conversar`);
                    }
                }
            } catch (kgError) {
                console.warn('[Memoria] Erro ao acessar Knowledge Graph:', kgError.message);
            }
        }

        if (perfil?.frequenciaContato) {
            partes.push(`Frequencia de contato: ${perfil.frequenciaContato}`);
        }

        if (partes.length === 0) {
            return '';
        }

        return `\n\n[CONTEXTO DO FILHO(A)]:\n${partes.join('\n')}\n`;
    } catch (error) {
        console.error('[Memoria] Erro em buildContext:', error.message);
        return '';
    }
}

// ═══════════════════════════════════════════════════════════════
// DETECÇÃO DE HUMOR
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta o humor predominante da mensagem
 * @param {string} mensagem - Mensagem do usuário
 * @returns {string} Humor detectado (triste, ansioso, feliz, neutro, desesperado, etc)
 */
export function detectMood(mensagem) {
    // Validar entrada
    if (!mensagem || typeof mensagem !== 'string') {
        return 'neutro';
    }

    try {
        const msgLower = mensagem.toLowerCase();

        // Pontuacao por categoria de humor
        const scores = {
            desesperado: 0,
            triste: 0,
            ansioso: 0,
            feliz: 0,
            grato: 0,
            confuso: 0,
            com_medo: 0,
            irritado: 0
        };

        // Palavras e padroes para cada humor
        const padroes = {
            desesperado: {
                palavras: ['desespero', 'desesperado', 'sem saida', 'nao aguento mais', 'quero morrer',
                          'acabou', 'perdido tudo', 'nao vejo solucao', 'sem esperanca'],
                peso: 3
            },
            triste: {
                palavras: ['triste', 'tristeza', 'deprimido', 'depressao', 'choro', 'chorando',
                          'sozinho', 'solidao', 'vazio', 'melancolia', 'luto'],
                peso: 2
            },
            ansioso: {
                palavras: ['ansioso', 'ansiedade', 'preocupado', 'preocupacao', 'nervoso',
                          'estresse', 'estressado', 'angustia', 'nao consigo parar de pensar'],
                peso: 2
            },
            feliz: {
                palavras: ['feliz', 'alegre', 'alegria', 'contente', 'animado', 'radiante',
                          'maravilhoso', 'otimo', 'excelente', 'melhor'],
                peso: 2
            },
            grato: {
                palavras: ['grato', 'gratidao', 'agradeco', 'obrigado', 'abencoado', 'grata',
                          'reconhecido', 'louvado seja'],
                peso: 2
            },
            confuso: {
                palavras: ['confuso', 'confusao', 'perdido', 'nao sei', 'duvida', 'incerto',
                          'desorientado', 'sem rumo'],
                peso: 1.5
            },
            com_medo: {
                palavras: ['medo', 'com medo', 'assustado', 'receio', 'temor', 'pavor',
                          'apavorado', 'aterrorizado'],
                peso: 2
            },
            irritado: {
                palavras: ['raiva', 'irritado', 'com raiva', 'bravo', 'furioso', 'indignado',
                          'revoltado', 'odio'],
                peso: 2
            }
        };

        // Calcula pontuacao para cada humor
        for (const [humor, config] of Object.entries(padroes)) {
            for (const palavra of config.palavras) {
                if (msgLower.includes(palavra)) {
                    scores[humor] += config.peso;
                }
            }
        }

        // Detecta pontuacao excessiva (!!!, ???) - indica emocao intensa
        const exclamacoes = (mensagem.match(/!{2,}/g) || []).length;
        const interrogacoes = (mensagem.match(/\?{2,}/g) || []).length;

        if (exclamacoes > 0) {
            if (scores.feliz > 0) scores.feliz += exclamacoes;
            if (scores.desesperado > 0) scores.desesperado += exclamacoes;
            if (scores.irritado > 0) scores.irritado += exclamacoes;
        }

        if (interrogacoes > 0) {
            if (scores.confuso > 0) scores.confuso += interrogacoes;
            if (scores.ansioso > 0) scores.ansioso += interrogacoes;
        }

        // Encontra o humor predominante
        let humorPredominante = 'neutro';
        let maxScore = 0;

        for (const [humor, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                humorPredominante = humor;
            }
        }

        return humorPredominante;
    } catch (error) {
        console.error('[Memoria] Erro em detectMood:', error.message);
        return 'neutro';
    }
}

// ═══════════════════════════════════════════════════════════════
// NOVO: DETECÇÃO DE RETORNO APÓS AUSÊNCIA
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta se usuário voltou após longo período de ausência
 * @param {string} userId - ID do usuário
 * @param {Date|string|number} lastContact - Data do último contato
 * @returns {Object} Informações sobre a ausência
 */
export function detectReturnAfterAbsence(userId, lastContact) {
    const defaultReturn = {
        isReturning: false,
        daysAway: 0,
        context: null,
        greeting: null
    };

    try {
        if (!userId || typeof userId !== 'string') {
            return defaultReturn;
        }

        const agora = Date.now();
        const ultimoContato = lastContact instanceof Date ? lastContact.getTime() :
                              typeof lastContact === 'string' ? new Date(lastContact).getTime() :
                              lastContact;

        if (!ultimoContato || isNaN(ultimoContato)) {
            return defaultReturn;
        }

        const diffMs = agora - ultimoContato;
        const diasAusente = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const semanasAusente = Math.floor(diasAusente / 7);
        const mesesAusente = Math.floor(diasAusente / 30);

        // Define niveis de ausencia
        if (diasAusente < 3) {
            return {
                isReturning: false,
                daysAway: diasAusente,
                context: null,
                greeting: null
            };
        }

        let context = '';
        let greeting = '';

        if (mesesAusente >= 1) {
            // Ausencia de mais de um mes
            context = `[RETORNO APOS LONGA AUSENCIA: ${mesesAusente} mes(es)]
Esta pessoa voltou depois de muito tempo. Demonstre alegria genuina pelo retorno.
Pergunte com carinho como ela tem passado todo esse tempo.
Nao pressione - deixe-a confortavel para compartilhar.`;

            greeting = mesesAusente === 1 ?
                'Filho(a), faz um mes que nao nos falamos! Que alegria ter voce de volta. Senti sua falta.' :
                `Filho(a), faz ${mesesAusente} meses que nao conversamos! Estava pensando em voce. Como tem passado todo esse tempo?`;
        } else if (semanasAusente >= 2) {
            // Ausencia de 2+ semanas
            context = `[RETORNO APOS ${semanasAusente} SEMANAS]
A pessoa voltou depois de algumas semanas. Acolha com carinho.
Pergunte gentilmente se aconteceu algo ou se apenas esteve ocupada.`;

            greeting = semanasAusente === 2 ?
                'Que bom te ver de volta! Faz duas semanas... aconteceu algo ou a vida estava corrida?' :
                `Fico feliz em te ver! Faz ${semanasAusente} semanas que nao conversamos. Estava torcendo por voce.`;
        } else if (diasAusente >= 7) {
            // Ausencia de 1 semana
            context = `[RETORNO APOS 1 SEMANA]
A pessoa voltou depois de cerca de uma semana. Demonstre que notou a ausencia.`;

            greeting = 'Ei, faz uma semana que nao nos falamos! Como voce esta? Aconteceu muita coisa nesse tempo?';
        } else {
            // 3-6 dias
            context = `[RETORNO APOS ${diasAusente} DIAS]
A pessoa voltou depois de alguns dias. Acolha naturalmente.`;

            greeting = diasAusente === 3 ?
                'Faz uns dias que nao conversamos. Como voce esta?' :
                `Oi! Faz ${diasAusente} dias que nao nos falamos. Tudo bem com voce?`;
        }

        // Salva observacao no Knowledge Graph
        addUserObservation(userId, `Retornou apos ${diasAusente} dias de ausencia em ${new Date().toLocaleDateString('pt-BR')}`);

        return {
            isReturning: true,
            daysAway: diasAusente,
            weeksAway: semanasAusente,
            monthsAway: mesesAusente,
            context: context,
            greeting: greeting
        };
    } catch (error) {
        console.error('[Memoria] Erro em detectReturnAfterAbsence:', error.message);
        return {
            isReturning: false,
            daysAway: 0,
            context: null,
            greeting: null
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// NOVO: RASTREAMENTO DE COMPROMISSOS DO USUÁRIO
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta e rastreia compromissos/promessas feitos pelo usuário
 * @param {string} userId - ID do usuário
 * @param {string} message - Mensagem do usuário
 * @returns {Object|null} Compromisso detectado ou null
 */
export function trackUserCommitments(userId, message) {
    try {
        if (!userId || typeof userId !== 'string') {
            return null;
        }
        if (!message || typeof message !== 'string') {
            return null;
        }

        const msgLower = message.toLowerCase();

        // Padroes de compromissos/promessas
        const commitmentPatterns = [
            // Promessas espirituais
            {
                patterns: [
                    /vou\s+(orar|rezar)\s*(mais|todos os dias|sempre|por|pela|pelo)?/i,
                    /vou\s+(jejuar|fazer jejum)/i,
                    /vou\s+(ler|estudar)\s*(a\s+)?biblia/i,
                    /vou\s+(meditar|fazer meditacao)/i,
                    /vou\s+(agradecer|louvar|adorar)\s*(mais|a deus)?/i
                ],
                type: 'spiritual_promise',
                priority: 'high',
                followUpDays: 7
            },
            // Promessas de mudanca pessoal
            {
                patterns: [
                    /vou\s+(tentar|me esforcar|fazer o possivel)/i,
                    /vou\s+(mudar|melhorar|ser melhor)/i,
                    /vou\s+(parar de|deixar de|evitar)\s+(.+)/i,
                    /vou\s+(comecar a|passar a)\s+(.+)/i
                ],
                type: 'personal_change',
                priority: 'medium',
                followUpDays: 14
            },
            // Promessas relacionais
            {
                patterns: [
                    /vou\s+(perdoar|reconciliar|fazer as pazes)/i,
                    /vou\s+(conversar|falar)\s+(com|sobre)/i,
                    /vou\s+(pedir desculpas|me desculpar)/i,
                    /vou\s+(ligar|visitar|ver)\s+(minha mae|meu pai|minha familia|meus pais)/i
                ],
                type: 'relational_promise',
                priority: 'high',
                followUpDays: 7
            },
            // Intencoes (menos firmes)
            {
                patterns: [
                    /(?:quero|preciso|tenho que|devo)\s+(mudar|melhorar|parar|comecar)/i,
                    /(?:preciso|tenho que)\s+(orar|rezar|buscar a deus)/i
                ],
                type: 'intention',
                priority: 'low',
                followUpDays: 21
            },
            // Compromissos com a igreja
            {
                patterns: [
                    /vou\s+(?:ir\s+)?(?:na|a|a)\s+(igreja|missa|culto|celula)/i,
                    /vou\s+(participar|frequentar)\s+(mais)?/i,
                    /vou\s+(?:me\s+)?batizar/i
                ],
                type: 'church_commitment',
                priority: 'medium',
                followUpDays: 7
            }
        ];

        for (const category of commitmentPatterns) {
            for (const pattern of category.patterns) {
                const match = message.match(pattern);
                if (match) {
                    const commitment = {
                        userId: userId,
                        type: category.type,
                        priority: category.priority,
                        originalMessage: match[0],
                        fullContext: message.substring(
                            Math.max(0, match.index - 50),
                            Math.min(message.length, match.index + match[0].length + 50)
                        ),
                        detectedAt: Date.now(),
                        followUpDate: Date.now() + (category.followUpDays * 24 * 60 * 60 * 1000),
                        status: 'pending',
                        followUpCount: 0
                    };

                    // Adiciona observacao no Knowledge Graph
                    addUserObservation(userId,
                        `Compromisso (${category.type}): "${match[0]}" em ${new Date().toLocaleDateString('pt-BR')}`
                    );

                    console.log(`[Compromisso] Detectado para ${userId}: ${match[0]} (${category.type})`);

                    return commitment;
                }
            }
        }

        return null;
    } catch (error) {
        console.error('[Memoria] Erro em trackUserCommitments:', error.message);
        return null;
    }
}

/**
 * Gera mensagem de follow-up para um compromisso
 * @param {Object} commitment - Objeto do compromisso
 * @returns {string} Mensagem de follow-up
 */
export function generateCommitmentFollowUp(commitment) {
    try {
        if (!commitment || typeof commitment !== 'object') {
            return 'Oi! Como voce esta? Estava pensando em voce.';
        }

        const originalMessage = commitment.originalMessage || 'aquele compromisso';

        const messages = {
            spiritual_promise: [
                `Lembrei de voce! Da ultima vez voce disse: "${originalMessage}". Como tem sido essa caminhada?`,
                `Oi! Fiquei pensando em voce... Conseguiu manter o que tinha proposto? "${originalMessage}"`,
                `So passando pra saber como esta. Aquele compromisso que voce fez consigo mesmo, como esta indo?`
            ],
            personal_change: [
                `Ei! Me lembrei que voce estava determinado(a) a fazer algumas mudancas. Como esta sendo?`,
                `Oi! So queria saber... aquela mudanca que voce queria fazer, tem conseguido?`,
                `Pensando em voce hoje. Como esta o processo de mudanca que voce mencionou?`
            ],
            relational_promise: [
                `Oi! Da ultima vez voce mencionou algo importante sobre relacionamentos. Conseguiu avancar nisso?`,
                `Lembrei de voce! Aquela situacao que voce queria resolver, como ficou?`,
                `Ei! So passando pra perguntar... conseguiu ter aquela conversa que voce mencionou?`
            ],
            intention: [
                `Oi! So passando pra saber como voce esta. Lembro que voce tinha algumas intencoes boas... como esta?`,
                `Pensando em voce hoje. Aquelas coisas que voce queria mudar, como esta a jornada?`
            ],
            church_commitment: [
                `Oi! Lembrei de voce. Conseguiu ir a igreja como tinha pensado?`,
                `Ei! Como foi a experiencia na igreja/culto? Quero saber!`,
                `So passando pra perguntar... como esta sua caminhada na comunidade de fe?`
            ]
        };

        const options = messages[commitment.type] || messages.intention;
        return options[Math.floor(Math.random() * options.length)];
    } catch (error) {
        console.error('[Memoria] Erro em generateCommitmentFollowUp:', error.message);
        return 'Oi! Como voce esta? Estava pensando em voce.';
    }
}

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE FOLLOW-UP
// ═══════════════════════════════════════════════════════════════

/**
 * Determina se deve agendar um follow-up com o usuário
 * @param {Object} perfil - Perfil do usuário
 * @param {string} resposta - Resposta que será enviada
 * @returns {boolean} true se deve agendar follow-up
 */
export function shouldFollowUp(perfil, resposta) {
    try {
        if (!perfil || typeof perfil !== 'object') {
            return false;
        }

        const sentimentos = Array.isArray(perfil.sentimentos) ? perfil.sentimentos : [];
        const compromissos = Array.isArray(perfil.compromissos) ? perfil.compromissos : [];
        const respostaStr = typeof resposta === 'string' ? resposta : '';

        // Situacoes que exigem follow-up
        const condicoesFollowUp = {
            // Humor critico
            humorCritico: sentimentos.includes('desespero') || sentimentos.includes('dor'),

            // Oracao ou bencao enviada
            oracaoEnviada: respostaStr &&
                           (respostaStr.toLowerCase().includes('orarei') ||
                            respostaStr.toLowerCase().includes('abencoo') ||
                            respostaStr.toLowerCase().includes('bencao')),

            // Primeiro contato ou retorno apos longo periodo
            primeiroContato: !perfil.ultimoContato,

            retornoLongo: perfil.ultimoContato &&
                          (Date.now() - new Date(perfil.ultimoContato).getTime()) > (7 * 24 * 60 * 60 * 1000), // 7 dias

            // Pedido de ajuda especifica
            pedidoAjuda: perfil.ultimaPergunta && typeof perfil.ultimaPergunta === 'string' &&
                         (perfil.ultimaPergunta.includes('me ajude') ||
                          perfil.ultimaPergunta.includes('preciso de ajuda')),

            // Compromissos pendentes
            compromissosPendentes: compromissos.some(c => c && c.status === 'pendente' && c.followUp)
        };

        // Retorna true se alguma condicao for verdadeira
        return Object.values(condicoesFollowUp).some(condicao => condicao === true);
    } catch (error) {
        console.error('[Memoria] Erro em shouldFollowUp:', error.message);
        return false;
    }
}

/**
 * Sugere horário ideal para follow-up baseado no padrão do usuário
 * @param {Object} perfil - Perfil do usuário com histórico de horários
 * @returns {Date} Data/hora sugerida para follow-up
 */
export function suggestFollowUpTime(perfil) {
    try {
        const agora = new Date();

        // Se temos historico de horarios, calcula media
        const horariosContato = perfil && Array.isArray(perfil.horariosContato) ? perfil.horariosContato : [];

        if (horariosContato.length > 0) {
            // Calcula hora media do dia
            const horasMedias = horariosContato.reduce((acc, h) => acc + (typeof h === 'number' ? h : 0), 0) / horariosContato.length;

            // Agenda para amanha no horario medio
            const followUp = new Date(agora);
            followUp.setDate(followUp.getDate() + 1);
            followUp.setHours(Math.floor(horasMedias), 0, 0, 0);

            return followUp;
        }

        // Se nao temos historico, agenda para 24h depois no mesmo horario
        const followUp = new Date(agora);
        followUp.setDate(followUp.getDate() + 1);

        return followUp;
    } catch (error) {
        console.error('[Memoria] Erro em suggestFollowUpTime:', error.message);
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 1);
        return fallback;
    }
}

// ═══════════════════════════════════════════════════════════════
// ANÁLISE DE FREQUÊNCIA
// ═══════════════════════════════════════════════════════════════

/**
 * Analisa a frequência de contato do usuário
 * @param {Array} historicoContatos - Array de timestamps dos contatos
 * @returns {string} Classificação da frequência (diária, semanal, mensal, esporádica)
 */
export function analyzeContactFrequency(historicoContatos) {
    try {
        if (!Array.isArray(historicoContatos) || historicoContatos.length < 2) {
            return 'primeira_vez';
        }

        // Calcula intervalo medio entre contatos
        const intervalos = [];
        for (let i = 1; i < historicoContatos.length; i++) {
            const curr = typeof historicoContatos[i] === 'number' ? historicoContatos[i] : 0;
            const prev = typeof historicoContatos[i - 1] === 'number' ? historicoContatos[i - 1] : 0;
            const intervalo = curr - prev;
            if (intervalo > 0) {
                intervalos.push(intervalo);
            }
        }

        if (intervalos.length === 0) {
            return 'primeira_vez';
        }

        const intervaloMedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
        const diasMedio = intervaloMedio / (1000 * 60 * 60 * 24);

        // Classifica frequencia
        if (diasMedio <= 1.5) return 'diaria';
        if (diasMedio <= 7) return 'semanal';
        if (diasMedio <= 30) return 'mensal';
        return 'esporadica';
    } catch (error) {
        console.error('[Memoria] Erro em analyzeContactFrequency:', error.message);
        return 'primeira_vez';
    }
}

/**
 * Registra horário de contato para análise de padrões
 * @param {Object} perfil - Perfil do usuário
 * @returns {Object} Perfil atualizado com novo horário
 */
export function registrarHorarioContato(perfil) {
    try {
        if (!perfil || typeof perfil !== 'object') {
            return { horariosContato: [new Date().getHours()] };
        }

        const agora = new Date();
        const hora = agora.getHours();

        if (!Array.isArray(perfil.horariosContato)) {
            perfil.horariosContato = [];
        }

        perfil.horariosContato.push(hora);

        // Mantem apenas os ultimos 30 registros
        if (perfil.horariosContato.length > 30) {
            perfil.horariosContato = perfil.horariosContato.slice(-30);
        }

        return perfil;
    } catch (error) {
        console.error('[Memoria] Erro em registrarHorarioContato:', error.message);
        return perfil || { horariosContato: [] };
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTAÇÃO DE CACHE DO KNOWLEDGE GRAPH (para persistência)
// ═══════════════════════════════════════════════════════════════

/**
 * Exporta o cache do Knowledge Graph para persistência
 * @returns {Object} Dados do cache
 */
export function exportKnowledgeGraphCache() {
    try {
        return {
            entities: Object.fromEntries(knowledgeGraphCache.entities),
            relations: Array.isArray(knowledgeGraphCache.relations) ? knowledgeGraphCache.relations : [],
            exportedAt: Date.now()
        };
    } catch (error) {
        console.error('[KnowledgeGraph] Erro em exportKnowledgeGraphCache:', error.message);
        return {
            entities: {},
            relations: [],
            exportedAt: Date.now()
        };
    }
}

/**
 * Importa dados para o cache do Knowledge Graph
 * @param {Object} data - Dados a importar
 */
export function importKnowledgeGraphCache(data) {
    try {
        if (!data || typeof data !== 'object') {
            console.warn('[KnowledgeGraph] Dados invalidos para importacao');
            return;
        }

        if (data.entities && typeof data.entities === 'object') {
            for (const [name, entity] of Object.entries(data.entities)) {
                if (name && entity) {
                    knowledgeGraphCache.entities.set(name, entity);
                }
            }
        }
        if (Array.isArray(data.relations)) {
            knowledgeGraphCache.relations = data.relations;
        }
        knowledgeGraphCache.lastSync = Date.now();
        console.log(`[KnowledgeGraph] Cache importado: ${knowledgeGraphCache.entities.size} entidades, ${knowledgeGraphCache.relations.length} relacionamentos`);
    } catch (error) {
        console.error('[KnowledgeGraph] Erro em importKnowledgeGraphCache:', error.message);
    }
}
