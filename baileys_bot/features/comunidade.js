/**
 * Comunidade - Jesus Cristo Bot
 * Sistema de conexões entre usuários para oração mútua, leitura bíblica e mentoria
 */

import {
    getUsuario,
    criarConexao,
    getConexao,
    getConexoesUsuario,
    sugerirConexoes,
    toggleComunidade,
    registrarCheckinConexao,
    getConexoesParaCheckin
} from '../database.js';

// Tipos de conexão disponíveis
const TIPOS_CONEXAO = {
    oracao_mutua: {
        nome: 'Parceiros de Oração',
        descricao: 'Orem um pelo outro regularmente',
        icone: '🙏'
    },
    parceiro_leitura: {
        nome: 'Parceiros de Leitura',
        descricao: 'Leiam a Bíblia juntos',
        icone: '📖'
    },
    mentor: {
        nome: 'Mentoria Espiritual',
        descricao: 'Acompanhamento espiritual personalizado',
        icone: '🌟'
    }
};

// Keywords para detectar mensagens relacionadas à comunidade
const COMUNIDADE_KEYWORDS = [
    'comunidade', 'participar comunidade', 'entrar comunidade',
    'parceiro de oração', 'parceiro oração', 'orar junto',
    'parceiro de leitura', 'ler bíblia junto', 'ler junto',
    'mentor', 'mentoria', 'acompanhamento espiritual',
    'minhas conexões', 'meus parceiros', 'sair comunidade',
    'conectar', 'conexão espiritual'
];

/**
 * Ativa a participação na comunidade
 * @param {string} jid - WhatsApp JID do usuário
 * @returns {object} Resultado da operação
 */
export function ativarComunidade(jid) {
    const sucesso = toggleComunidade(jid, true);

    if (sucesso) {
        return {
            sucesso: true,
            mensagem: `Bem-vindo(a) à nossa comunidade! 🕊️

Agora você pode:
${Object.entries(TIPOS_CONEXAO).map(([key, tipo]) => `${tipo.icone} ${tipo.nome} - ${tipo.descricao}`).join('\n')}

Para encontrar parceiros, diga "buscar parceiros" ou "sugerir conexões".

"Onde dois ou três estiverem reunidos em meu nome, ali estou eu no meio deles." - Mateus 18:20`
        };
    }

    return {
        sucesso: false,
        mensagem: 'Não foi possível ativar sua participação na comunidade. Tente novamente mais tarde.'
    };
}

/**
 * Desativa a participação na comunidade
 * @param {string} jid - WhatsApp JID do usuário
 * @returns {object} Resultado da operação
 */
export function desativarComunidade(jid) {
    const sucesso = toggleComunidade(jid, false);

    if (sucesso) {
        return {
            sucesso: true,
            mensagem: `Você saiu da comunidade. Suas conexões existentes serão mantidas, mas você não receberá novas sugestões.

Quando quiser voltar, é só dizer "entrar comunidade". Estarei aqui! 🙏`
        };
    }

    return {
        sucesso: false,
        mensagem: 'Não foi possível processar sua saída da comunidade. Tente novamente.'
    };
}

/**
 * Sugere conexões para um usuário baseado em interesses
 * @param {number} usuarioId - ID do usuário
 * @returns {object} Sugestões de conexão
 */
export function sugerirConexao(usuarioId) {
    const sugestoes = sugerirConexoes(usuarioId, 5);

    if (sugestoes.length === 0) {
        return {
            tipo: 'sem_sugestoes',
            mensagem: `No momento não encontrei novos parceiros disponíveis.

Isso pode acontecer se:
- Você já está conectado com todos os membros ativos
- Poucos membros estão na comunidade

Continue orando e em breve teremos mais irmãos para conectar! 🙏`
        };
    }

    let mensagem = `🕊️ *Sugestões de Conexão*\n\n`;
    mensagem += `Encontrei ${sugestoes.length} irmão(s) disponível(is):\n\n`;

    sugestoes.forEach((s, i) => {
        const nivel = s.nivel ? ` (${s.nivel})` : '';
        mensagem += `${i + 1}. ${s.nome || 'Irmão(ã)'}${nivel}\n`;
    });

    mensagem += `\nPara conectar, diga:\n`;
    mensagem += `- "conectar [número] para oração" - parceiro de oração\n`;
    mensagem += `- "conectar [número] para leitura" - parceiro de leitura\n`;
    mensagem += `- "conectar [número] anonimamente" - conexão anônima\n`;

    return {
        tipo: 'sugestoes',
        sugestoes,
        mensagem
    };
}

/**
 * Cria uma conexão de oração entre dois usuários
 * @param {number} usuarioA - ID do primeiro usuário
 * @param {number} usuarioB - ID do segundo usuário
 * @param {boolean} anonimo - Se a conexão é anônima
 * @returns {object} Resultado da conexão
 */
export function criarConexaoOracao(usuarioA, usuarioB, anonimo = false) {
    // Verifica se já existe conexão
    const conexaoExistente = getConexao(usuarioA, usuarioB, 'oracao_mutua');

    if (conexaoExistente) {
        return {
            sucesso: false,
            mensagem: 'Vocês já estão conectados como parceiros de oração! 🙏'
        };
    }

    const conexao = criarConexao(usuarioA, usuarioB, 'oracao_mutua', anonimo);

    if (conexao) {
        const tipoMsg = anonimo
            ? 'Sua identidade será preservada - vocês podem orar um pelo outro sem saber quem é.'
            : 'Vocês agora podem compartilhar pedidos e orar um pelo outro.';

        return {
            sucesso: true,
            conexao,
            mensagem: `Conexão de oração criada! 🙏✨

${tipoMsg}

"Confessai as vossas culpas uns aos outros, e orai uns pelos outros, para que sareis." - Tiago 5:16

Dica: Use "pedido para parceiro" para enviar um pedido de oração ao seu parceiro.`
        };
    }

    return {
        sucesso: false,
        mensagem: 'Não foi possível criar a conexão. Tente novamente.'
    };
}

/**
 * Cria uma conexão de leitura bíblica entre dois usuários
 * @param {number} usuarioA - ID do primeiro usuário
 * @param {number} usuarioB - ID do segundo usuário
 * @returns {object} Resultado da conexão
 */
export function criarConexaoLeitura(usuarioA, usuarioB) {
    const conexaoExistente = getConexao(usuarioA, usuarioB, 'parceiro_leitura');

    if (conexaoExistente) {
        return {
            sucesso: false,
            mensagem: 'Vocês já estão conectados como parceiros de leitura! 📖'
        };
    }

    const conexao = criarConexao(usuarioA, usuarioB, 'parceiro_leitura', false);

    if (conexao) {
        return {
            sucesso: true,
            conexao,
            mensagem: `Parceria de leitura criada! 📖✨

Agora vocês podem:
- Compartilhar reflexões sobre os textos
- Acompanhar o progresso um do outro
- Discutir versículos juntos

"Examinais as Escrituras, porque vós cuidais ter nelas a vida eterna" - João 5:39`
        };
    }

    return {
        sucesso: false,
        mensagem: 'Não foi possível criar a parceria de leitura. Tente novamente.'
    };
}

/**
 * Cria uma conexão de mentoria espiritual
 * @param {number} mentorId - ID do mentor
 * @param {number} mentoradoId - ID do mentorado
 * @returns {object} Resultado da conexão
 */
export function criarConexaoMentoria(mentorId, mentoradoId) {
    const conexaoExistente = getConexao(mentorId, mentoradoId, 'mentor');

    if (conexaoExistente) {
        return {
            sucesso: false,
            mensagem: 'Esta mentoria já existe! 🌟'
        };
    }

    const conexao = criarConexao(mentorId, mentoradoId, 'mentor', false);

    if (conexao) {
        return {
            sucesso: true,
            conexao,
            mensagem: `Mentoria espiritual iniciada! 🌟

Uma jornada de crescimento começou. O mentor poderá:
- Acompanhar o progresso espiritual
- Oferecer orientação e encorajamento
- Compartilhar sabedoria e experiência

"O que ouviste de mim, transmite a homens fiéis, que sejam idôneos para também ensinarem outros." - 2 Timóteo 2:2`
        };
    }

    return {
        sucesso: false,
        mensagem: 'Não foi possível iniciar a mentoria. Tente novamente.'
    };
}

/**
 * Obtém as conexões de um usuário
 * @param {number} usuarioId - ID do usuário
 * @returns {object} Lista de conexões formatada
 */
export function getMinhasConexoes(usuarioId) {
    const conexoes = getConexoesUsuario(usuarioId);

    if (conexoes.length === 0) {
        return {
            tipo: 'sem_conexoes',
            conexoes: [],
            mensagem: `Você ainda não tem conexões na comunidade.

Para começar, diga "buscar parceiros" e encontre irmãos para caminhar junto! 🕊️

"Melhor é serem dois do que um, porque têm melhor paga do seu trabalho." - Eclesiastes 4:9`
        };
    }

    let mensagem = `🕊️ *Minhas Conexões*\n\n`;

    // Agrupa por tipo
    const porTipo = {};
    conexoes.forEach(c => {
        if (!porTipo[c.tipo]) porTipo[c.tipo] = [];
        porTipo[c.tipo].push(c);
    });

    for (const [tipo, lista] of Object.entries(porTipo)) {
        const tipoInfo = TIPOS_CONEXAO[tipo];
        mensagem += `${tipoInfo.icone} *${tipoInfo.nome}*\n`;

        lista.forEach(c => {
            const nome = c.anonimo ? 'Irmão(ã) anônimo(a)' : (c.parceiro_nome || 'Irmão(ã)');
            const checkin = c.ultimo_checkin
                ? `Último contato: ${new Date(c.ultimo_checkin).toLocaleDateString('pt-BR')}`
                : 'Sem check-in ainda';
            mensagem += `  - ${nome}\n    _${checkin}_\n`;
        });
        mensagem += '\n';
    }

    mensagem += `_Total: ${conexoes.length} conexão(ões)_`;

    return {
        tipo: 'lista',
        conexoes,
        mensagem
    };
}

/**
 * Gera estatísticas do grupo de oração anônimo
 * @param {string} categoria - Categoria opcional (saude, familia, etc)
 * @returns {object} Estatísticas formatadas
 */
export function getGrupoOracaoAnonimo(categoria = null) {
    // Esta função simula um grupo de oração onde pessoas oram por categorias
    // sem saber quem são os outros

    // Em uma implementação real, buscaria do banco de dados
    const categorias = {
        saude: { count: 12, label: 'saúde' },
        familia: { count: 8, label: 'família' },
        trabalho: { count: 5, label: 'trabalho' },
        financeiro: { count: 7, label: 'área financeira' },
        relacionamento: { count: 4, label: 'relacionamentos' },
        espiritual: { count: 15, label: 'crescimento espiritual' }
    };

    if (categoria && categorias[categoria]) {
        const cat = categorias[categoria];
        return {
            tipo: 'categoria_especifica',
            mensagem: `🙏 *Grupo de Oração Anônimo*

${cat.count} pessoas estão orando por ${cat.label} neste momento.

Você não está só. Junte-se em oração silenciosa sabendo que outros irmãos estão intercedendo pela mesma causa.

"Novamente vos digo que, se dois de vós na terra concordarem acerca de qualquer coisa que pedirem, isso lhes será feito por meu Pai, que está nos céus." - Mateus 18:19`
        };
    }

    let mensagem = `🙏 *Grupo de Oração Anônimo*\n\n`;
    mensagem += `Pessoas orando agora:\n\n`;

    for (const [key, cat] of Object.entries(categorias)) {
        mensagem += `- ${cat.count} pessoas por ${cat.label}\n`;
    }

    mensagem += `\nDiga "orar por [categoria]" para se juntar a um grupo.`;

    return {
        tipo: 'visao_geral',
        categorias,
        mensagem
    };
}

/**
 * Processa mensagem relacionada à comunidade
 * @param {string} jid - WhatsApp JID
 * @param {string} texto - Texto da mensagem
 * @returns {object|null} Resposta ou null
 */
export async function processarMensagemComunidade(jid, texto) {
    const usuario = getUsuario(jid);
    if (!usuario) return null;

    const textoLower = texto.toLowerCase();

    // Ativar comunidade
    if (textoLower.includes('entrar comunidade') ||
        textoLower.includes('participar comunidade') ||
        textoLower.includes('ativar comunidade')) {
        return ativarComunidade(jid);
    }

    // Desativar comunidade
    if (textoLower.includes('sair comunidade') ||
        textoLower.includes('desativar comunidade')) {
        return desativarComunidade(jid);
    }

    // Listar conexões
    if (textoLower.includes('minhas conexões') ||
        textoLower.includes('meus parceiros') ||
        textoLower.includes('minha comunidade')) {
        return getMinhasConexoes(usuario.id);
    }

    // Buscar parceiros / sugestões
    if (textoLower.includes('buscar parceiro') ||
        textoLower.includes('sugerir conex') ||
        textoLower.includes('encontrar parceiro')) {

        // Verifica se está na comunidade
        if (!usuario.comunidade_opt_in) {
            return {
                tipo: 'nao_participante',
                mensagem: `Para buscar parceiros, primeiro entre na comunidade dizendo "entrar comunidade".

A comunidade é um espaço seguro para conexões espirituais. 🕊️`
            };
        }

        return sugerirConexao(usuario.id);
    }

    // Conectar com sugestão específica
    const matchConectar = textoLower.match(/conectar (\d+)(?: para (ora[çc][aã]o|leitura))?(?: anonimamente)?/);
    if (matchConectar) {
        // Isso precisaria manter estado das sugestões anteriores
        // Por simplicidade, retorna orientação
        return {
            tipo: 'orientacao_conexao',
            mensagem: `Para se conectar, primeiro use "buscar parceiros" para ver as sugestões disponíveis, depois escolha o número e o tipo de conexão.`
        };
    }

    // Grupo de oração anônimo
    if (textoLower.includes('grupo de oração') ||
        textoLower.includes('oração anônima') ||
        textoLower.includes('quantos orando')) {

        // Verifica se especificou categoria
        const categorias = ['saude', 'familia', 'trabalho', 'financeiro', 'relacionamento', 'espiritual'];
        const categoriaEncontrada = categorias.find(c => textoLower.includes(c.replace('a', '[aá]')));

        return getGrupoOracaoAnonimo(categoriaEncontrada);
    }

    return null;
}

/**
 * Verifica se mensagem é relacionada à comunidade
 * @param {string} texto - Texto da mensagem
 * @returns {boolean}
 */
export function isComunidadeRelated(texto) {
    const textoLower = texto.toLowerCase();
    return COMUNIDADE_KEYWORDS.some(k => textoLower.includes(k));
}

/**
 * Processa check-in periódico das conexões
 * Envia lembretes para conexões que não tiveram interação recente
 * @param {function} sendFunction - Função para enviar mensagem
 * @returns {object} Resultado do processamento
 */
export async function checkInConexoes(sendFunction) {
    const conexoes = getConexoesParaCheckin(7); // 7 dias sem check-in
    const resultados = { enviados: 0, erros: 0 };

    console.log(`[Comunidade] Processando check-in de ${conexoes.length} conexões`);

    for (const conexao of conexoes) {
        try {
            const tipoInfo = TIPOS_CONEXAO[conexao.tipo];

            // Envia para ambos os membros da conexão
            const mensagemA = gerarMensagemCheckin(conexao, 'a', tipoInfo);
            const mensagemB = gerarMensagemCheckin(conexao, 'b', tipoInfo);

            await sendFunction(conexao.telefone_a, mensagemA);
            await sendFunction(conexao.telefone_b, mensagemB);

            // Registra o check-in
            registrarCheckinConexao(conexao.id);

            resultados.enviados += 2;

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`[Comunidade] Erro no check-in ${conexao.id}:`, error);
            resultados.erros++;
        }
    }

    console.log(`[Comunidade] Check-in concluído: ${resultados.enviados} mensagens enviadas`);
    return resultados;
}

/**
 * Gera mensagem de check-in personalizada
 * @param {object} conexao - Dados da conexão
 * @param {string} destinatario - 'a' ou 'b'
 * @param {object} tipoInfo - Informações do tipo de conexão
 * @returns {string} Mensagem de check-in
 */
function gerarMensagemCheckin(conexao, destinatario, tipoInfo) {
    const nomeOutro = destinatario === 'a'
        ? (conexao.anonimo ? 'seu(sua) parceiro(a) anônimo(a)' : conexao.nome_b || 'seu(sua) irmão(ã)')
        : (conexao.anonimo ? 'seu(sua) parceiro(a) anônimo(a)' : conexao.nome_a || 'seu(sua) irmão(ã)');

    const mensagens = {
        oracao_mutua: [
            `Lembrei de você e ${nomeOutro}! 🙏\n\nComo estão as orações em conjunto? Já conversaram essa semana?\n\nUma palavra de encorajamento pode fazer toda diferença.`,
            `Paz! Uma semana se passou desde a última conexão com ${nomeOutro}.\n\nQue tal enviar uma mensagem perguntando como pode orar hoje? 🙏`,
        ],
        parceiro_leitura: [
            `Olá! 📖 Como está a leitura com ${nomeOutro}?\n\nCompartilhem o que Deus tem falado através da Palavra. A troca de reflexões edifica!`,
            `Paz! Já fizeram a leitura bíblica juntos essa semana? 📖\n\nLembre-se: "Lâmpada para os meus pés é tua palavra" - Salmo 119:105`,
        ],
        mentor: [
            `Paz! 🌟 Como está a caminhada de mentoria com ${nomeOutro}?\n\nO acompanhamento regular fortalece a fé de ambos!`,
            `Uma semana se passou desde o último contato da mentoria com ${nomeOutro}. 🌟\n\nQue tal marcar uma conversa?`,
        ]
    };

    const opcoes = mensagens[conexao.tipo] || mensagens.oracao_mutua;
    return opcoes[Math.floor(Math.random() * opcoes.length)];
}

export default {
    ativarComunidade,
    desativarComunidade,
    sugerirConexao,
    criarConexaoOracao,
    criarConexaoLeitura,
    criarConexaoMentoria,
    getMinhasConexoes,
    getGrupoOracaoAnonimo,
    processarMensagemComunidade,
    isComunidadeRelated,
    checkInConexoes
};
