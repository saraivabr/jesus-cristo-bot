/**
 * Pedidos de Oração - Jesus Cristo Bot
 * Sistema de registro e acompanhamento de pedidos de oração
 */

import * as db from '../database.js';
import * as gemini from '../gemini.js';

// Categorias de pedidos
const CATEGORIAS = {
    saude: ['doença', 'doente', 'hospital', 'cura', 'saúde', 'médico', 'cirurgia', 'exame'],
    familia: ['família', 'filho', 'filha', 'esposo', 'esposa', 'pai', 'mãe', 'irmão', 'irmã', 'casamento'],
    trabalho: ['emprego', 'trabalho', 'desemprego', 'empresa', 'chefe', 'salário', 'carreira'],
    financeiro: ['dinheiro', 'dívida', 'financeiro', 'conta', 'aluguel', 'pagar'],
    relacionamento: ['namoro', 'namorado', 'namorada', 'relacionamento', 'amizade', 'solidão'],
    espiritual: ['fé', 'dúvida', 'pecado', 'tentação', 'perdão', 'conversão'],
    outros: []
};

// Níveis de urgência
const URGENCIA_KEYWORDS = {
    critico: ['urgente', 'emergência', 'desesperado', 'não aguento mais', 'última esperança', 'grave'],
    urgente: ['muito', 'preciso muito', 'por favor', 'ajuda', 'difícil']
};

/**
 * Registra um novo pedido de oração
 * @param {number} usuarioId - ID do usuário
 * @param {string} pedido - Texto do pedido
 * @returns {object} Pedido criado com resposta personalizada
 */
export async function registrarPedido(usuarioId, pedido) {
    try {
        // Detecta categoria
        const categoria = detectarCategoria(pedido);

        // Detecta urgência
        const urgencia = detectarUrgencia(pedido);

        // Salva no banco
        const pedidoSalvo = db.addPedidoOracao(usuarioId, pedido, categoria, urgencia);

        // Gera resposta personalizada
        const resposta = await gerarRespostaOracao(pedido, categoria, urgencia);

        return {
            pedido: pedidoSalvo,
            resposta
        };
    } catch (error) {
        console.error('[PedidosOracao] Erro ao registrar:', error);
        return {
            pedido: null,
            resposta: 'Recebi seu pedido de oração. Estou orando por você. 🙏'
        };
    }
}

/**
 * Detecta a categoria do pedido
 * @param {string} texto - Texto do pedido
 * @returns {string} Categoria detectada
 */
function detectarCategoria(texto) {
    const textoLower = texto.toLowerCase();

    for (const [categoria, keywords] of Object.entries(CATEGORIAS)) {
        if (keywords.some(k => textoLower.includes(k))) {
            return categoria;
        }
    }

    return 'outros';
}

/**
 * Detecta o nível de urgência
 * @param {string} texto - Texto do pedido
 * @returns {string} Nível de urgência
 */
function detectarUrgencia(texto) {
    const textoLower = texto.toLowerCase();

    if (URGENCIA_KEYWORDS.critico.some(k => textoLower.includes(k))) {
        return 'critico';
    }

    if (URGENCIA_KEYWORDS.urgente.some(k => textoLower.includes(k))) {
        return 'urgente';
    }

    return 'normal';
}

/**
 * Gera resposta personalizada para o pedido
 * @param {string} pedido - Texto do pedido
 * @param {string} categoria - Categoria
 * @param {string} urgencia - Urgência
 * @returns {string} Resposta
 */
async function gerarRespostaOracao(pedido, categoria, urgencia) {
    const prompt = `Uma pessoa fez um pedido de oração. Responda com compaixão e esperança.

PEDIDO: "${pedido}"
CATEGORIA: ${categoria}
URGÊNCIA: ${urgencia}

Responda em no máximo 100 palavras:
1. Mostre que você ouviu e se importa
2. Ofereça palavras de conforto baseadas na situação
3. Inclua uma breve oração ou versículo relevante
4. Termine com esperança

Fale como Jesus falaria: com amor profundo e presença.`;

    try {
        const response = await gemini.generateResponse('system_oracao', prompt);
        return response;
    } catch (error) {
        return getRespostaPadrao(categoria, urgencia);
    }
}

/**
 * Obtém resposta padrão baseada na categoria
 * @param {string} categoria - Categoria
 * @param {string} urgencia - Urgência
 * @returns {string} Resposta padrão
 */
function getRespostaPadrao(categoria, urgencia) {
    const respostas = {
        saude: 'Clamo ao Senhor pela tua cura. "Eu sou o Senhor que te sara" (Êxodo 15:26). Confie nEle. 🙏',
        familia: 'Que a paz de Deus guarde sua família. "Quanto a mim e à minha casa, serviremos ao Senhor" (Josué 24:15). Estou orando por vocês.',
        trabalho: 'Deus é provedor. "O Senhor é meu pastor, nada me faltará" (Salmo 23:1). Confie que Ele abrirá as portas certas. 🙏',
        financeiro: 'Entrego sua situação nas mãos do Pai. "Buscai primeiro o Reino de Deus, e todas essas coisas vos serão acrescentadas" (Mateus 6:33).',
        relacionamento: 'Que o amor de Deus preencha seu coração. "O amor é paciente, o amor é bondoso" (1 Coríntios 13:4). Você não está só.',
        espiritual: 'Sua fé me alegra. "Pedi e dar-se-vos-á; buscai e encontrareis" (Mateus 7:7). Continue buscando. 🙏',
        outros: 'Recebi seu pedido com carinho. Estou intercedendo por você. "Vinde a mim todos os que estais cansados e oprimidos" (Mateus 11:28). 🙏'
    };

    let resposta = respostas[categoria] || respostas.outros;

    if (urgencia === 'critico') {
        resposta = `Estou aqui com você neste momento difícil. ${resposta} Não desista. Deus está trabalhando.`;
    }

    return resposta;
}

/**
 * Processa follow-ups de pedidos de oração
 * @param {function} sendFunction - Função para enviar mensagem
 * @returns {object} Resultado do processamento
 */
export async function followUpOracao(sendFunction) {
    const pedidos = db.getPedidosParaFollowup(3); // 3 dias desde último follow-up
    const resultados = { enviados: 0, erros: 0 };

    console.log(`[PedidosOracao] Processando follow-up de ${pedidos.length} pedidos`);

    for (const pedido of pedidos) {
        try {
            const mensagem = await gerarMensagemFollowup(pedido);

            await sendFunction(pedido.telefone, mensagem);
            db.registrarFollowupOracao(pedido.id);

            resultados.enviados++;

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`[PedidosOracao] Erro no follow-up ${pedido.id}:`, error);
            resultados.erros++;
        }
    }

    console.log(`[PedidosOracao] Follow-up concluído: ${resultados.enviados} enviados`);
    return resultados;
}

/**
 * Gera mensagem de follow-up personalizada
 * @param {object} pedido - Dados do pedido
 * @returns {string} Mensagem de follow-up
 */
async function gerarMensagemFollowup(pedido) {
    const diasDesde = Math.floor((Date.now() - new Date(pedido.criado_em).getTime()) / (1000 * 60 * 60 * 24));

    const mensagens = {
        3: `${pedido.nome ? pedido.nome + ', ' : ''}lembrei de você em oração. Como está aquela situação que você compartilhou comigo? Continuo intercedendo. 🙏`,
        7: `Uma semana se passou e você continua em meu coração. Como estão as coisas? Houve alguma mudança que gostaria de compartilhar?`,
        14: `Duas semanas orando por você. Gostaria de saber como você está. Se houver novidades, compartilhe comigo. Estou aqui.`
    };

    // Escolhe mensagem baseada nos dias
    let mensagem;
    if (diasDesde <= 4) {
        mensagem = mensagens[3];
    } else if (diasDesde <= 10) {
        mensagem = mensagens[7];
    } else {
        mensagem = mensagens[14];
    }

    return mensagem;
}

/**
 * Processa resposta a um follow-up
 * @param {string} jid - WhatsApp JID
 * @param {string} texto - Texto da resposta
 * @returns {object|null} Resultado ou null
 */
export async function processarRespostaFollowup(jid, texto) {
    const usuario = db.getUsuario(jid);
    if (!usuario) return null;

    const pedidos = db.getPedidosOracao(usuario.id);
    if (pedidos.length === 0) return null;

    const textoLower = texto.toLowerCase();

    // Detecta se é um testemunho positivo
    const palavrasPositivas = ['melhorou', 'respondeu', 'curou', 'consegui', 'deu certo', 'resolveu', 'graças a deus', 'aleluia'];
    const ehTestemunho = palavrasPositivas.some(p => textoLower.includes(p));

    if (ehTestemunho) {
        // Pede testemunho
        return {
            tipo: 'testemunho_detectado',
            mensagem: 'Que maravilha! Deus é fiel! 🎉\n\nGostaria de registrar esse testemunho? Conte-me mais sobre como Deus agiu. Seu testemunho pode fortalecer outros que estão passando por situações semelhantes.',
            pedidoId: pedidos[0].id
        };
    }

    return null;
}

/**
 * Registra um testemunho
 * @param {number} pedidoId - ID do pedido
 * @param {string} testemunho - Texto do testemunho
 * @returns {object} Resultado
 */
export async function salvarTestemunho(pedidoId, testemunho) {
    const pedido = db.registrarTestemunho(pedidoId, testemunho);

    if (pedido) {
        return {
            sucesso: true,
            mensagem: 'Que testemunho lindo! 🙏✨\n\nGlória a Deus pela Sua fidelidade! Seu testemunho foi guardado e pode inspirar outros a também confiarem no Senhor.\n\n"Grandes coisas fez o Senhor por nós, e por isso estamos alegres." - Salmo 126:3'
        };
    }

    return {
        sucesso: false,
        mensagem: 'Não consegui salvar o testemunho, mas fico muito feliz pela resposta de Deus em sua vida!'
    };
}

/**
 * Lista pedidos de oração de um usuário
 * @param {number} usuarioId - ID do usuário
 * @returns {string} Lista formatada
 */
export function listarPedidos(usuarioId) {
    const pedidos = db.getPedidosOracao(usuarioId);

    if (pedidos.length === 0) {
        return 'Você não tem pedidos de oração ativos. Se quiser, pode me contar o que está em seu coração.';
    }

    let lista = '📿 *Seus Pedidos de Oração*\n\n';

    pedidos.forEach((p, i) => {
        const data = new Date(p.criado_em).toLocaleDateString('pt-BR');
        const urgenciaIcon = p.urgencia === 'critico' ? '🔴' : p.urgencia === 'urgente' ? '🟡' : '🟢';
        lista += `${i + 1}. ${urgenciaIcon} ${p.pedido.substring(0, 50)}...\n   ${data} - ${p.categoria}\n\n`;
    });

    lista += 'Para arquivar um pedido respondido, diga "arquivar pedido [número]"';

    return lista;
}

/**
 * Arquiva um pedido
 * @param {number} usuarioId - ID do usuário
 * @param {number} indice - Índice do pedido (1-based)
 * @returns {object} Resultado
 */
export function arquivarPedido(usuarioId, indice) {
    const pedidos = db.getPedidosOracao(usuarioId);

    if (indice < 1 || indice > pedidos.length) {
        return {
            sucesso: false,
            mensagem: 'Número de pedido inválido. Use "meus pedidos" para ver a lista.'
        };
    }

    const pedido = pedidos[indice - 1];
    db.arquivarPedidoOracao(pedido.id);

    return {
        sucesso: true,
        mensagem: 'Pedido arquivado. Se Deus respondeu, não esqueça de dar testemunho! 🙏'
    };
}

/**
 * Verifica se mensagem é relacionada a oração
 * @param {string} texto - Texto da mensagem
 * @returns {boolean}
 */
export function isOracaoRelated(texto) {
    const keywords = [
        'oração', 'oracao', 'ore por', 'ora por', 'pedido de oração',
        'preciso de oração', 'interceda', 'meus pedidos', 'arquivar pedido'
    ];
    const textoLower = texto.toLowerCase();
    return keywords.some(k => textoLower.includes(k));
}

/**
 * Processa mensagem relacionada a oração
 * @param {string} jid - WhatsApp JID
 * @param {string} texto - Texto da mensagem
 * @returns {object|null} Resposta ou null
 */
export async function processarMensagemOracao(jid, texto) {
    const usuario = db.getUsuario(jid);
    if (!usuario) return null;

    const textoLower = texto.toLowerCase();

    // Listar pedidos
    if (textoLower.includes('meus pedidos') || textoLower.includes('lista de orações')) {
        return {
            tipo: 'lista',
            mensagem: listarPedidos(usuario.id)
        };
    }

    // Arquivar pedido
    const matchArquivar = textoLower.match(/arquivar pedido (\d+)/);
    if (matchArquivar) {
        const indice = parseInt(matchArquivar[1]);
        return arquivarPedido(usuario.id, indice);
    }

    // Novo pedido de oração
    if (textoLower.includes('ore por') || textoLower.includes('ora por') ||
        textoLower.includes('pedido de oração') || textoLower.includes('preciso de oração')) {

        // Extrai o pedido (remove a trigger phrase)
        let pedido = texto
            .replace(/ore por mim/gi, '')
            .replace(/ora por mim/gi, '')
            .replace(/pedido de oração:?/gi, '')
            .replace(/preciso de oração:?/gi, '')
            .trim();

        if (pedido.length < 10) {
            return {
                tipo: 'incompleto',
                mensagem: 'Conte-me mais sobre sua necessidade. O que está em seu coração?'
            };
        }

        const resultado = await registrarPedido(usuario.id, pedido);
        return {
            tipo: 'registrado',
            mensagem: resultado.resposta
        };
    }

    return null;
}

export default {
    registrarPedido,
    followUpOracao,
    processarRespostaFollowup,
    salvarTestemunho,
    listarPedidos,
    arquivarPedido,
    isOracaoRelated,
    processarMensagemOracao
};
