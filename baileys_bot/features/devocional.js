/**
 * Devocional Diário - Jesus Cristo Bot
 * Gera e envia devocionais personalizados
 */

import * as db from '../database.js';
import * as gemini from '../gemini.js';
import { searchKnowledge } from '../knowledgeBase.js';

// Temas para devocionais baseados no contexto emocional
const TEMAS_POR_HUMOR = {
    positivo: ['gratidao', 'louvor', 'alegria', 'servico', 'testemunho'],
    neutro: ['sabedoria', 'fe', 'proposito', 'crescimento', 'oracao'],
    negativo: ['esperanca', 'conforto', 'paz', 'forca', 'restauracao'],
    crise: ['socorro', 'presenca_divina', 'promessas', 'cura', 'libertacao']
};

// Temas gerais rotativos
const TEMAS_GERAIS = [
    'amor', 'fe', 'esperanca', 'paz', 'paciencia', 'bondade',
    'perdao', 'gratidao', 'sabedoria', 'oracao', 'servico',
    'humildade', 'coragem', 'confianca', 'renovacao', 'proposito'
];

/**
 * Gera um devocional personalizado para um usuário
 * @param {object} usuario - Dados do usuário
 * @returns {object} Devocional gerado
 */
export async function gerarDevocional(usuario) {
    try {
        // Determina o tema baseado no contexto emocional
        const tema = await escolherTema(usuario);

        // Busca versículo relevante no knowledge base
        const resultados = await searchKnowledge(tema);
        const versiculo = resultados.length > 0
            ? resultados[0].content
            : await buscarVersiculoGemini(tema);

        // Gera reflexão personalizada com Gemini
        const reflexao = await gerarReflexao(usuario, tema, versiculo);

        // Salva no banco
        const devocional = db.saveDevocional(
            usuario.id,
            new Date().toISOString().split('T')[0],
            tema,
            versiculo,
            reflexao
        );

        return devocional;
    } catch (error) {
        console.error('[Devocional] Erro ao gerar:', error);
        return null;
    }
}

/**
 * Escolhe o tema do devocional baseado no contexto do usuário
 * @param {object} usuario - Dados do usuário
 * @returns {string} Tema escolhido
 */
async function escolherTema(usuario) {
    // Tenta detectar humor recente do usuário
    const patterns = db.getEmotionalPatterns(usuario.id);
    const diaAtual = new Date().getDay();
    const patternHoje = patterns.find(p => p.dia_semana === diaAtual);

    let humor = 'neutro';
    if (patternHoje?.humor_predominante) {
        humor = patternHoje.humor_predominante;
    }

    // Seleciona tema baseado no humor
    const temasDisponiveis = TEMAS_POR_HUMOR[humor] || TEMAS_POR_HUMOR.neutro;

    // Verifica temas já usados recentemente
    const temasRecentes = await getTemasRecentes(usuario.id, 7);
    const temasNovos = temasDisponiveis.filter(t => !temasRecentes.includes(t));

    // Se todos já foram usados, usa qualquer um
    const pool = temasNovos.length > 0 ? temasNovos : temasDisponiveis;

    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Obtém temas usados nos últimos N dias
 * @param {number} usuarioId - ID do usuário
 * @param {number} dias - Número de dias
 * @returns {array} Lista de temas
 */
async function getTemasRecentes(usuarioId, dias) {
    try {
        const stmt = db.db.prepare(`
            SELECT tema FROM devocionais
            WHERE usuario_id = ?
            AND date(data) >= date('now', '-' || ? || ' days')
        `);
        return stmt.all(usuarioId, dias).map(r => r.tema);
    } catch (error) {
        return [];
    }
}

/**
 * Busca versículo via Gemini quando não encontra no knowledge base
 * @param {string} tema - Tema do devocional
 * @returns {string} Versículo
 */
async function buscarVersiculoGemini(tema) {
    const prompt = `Sugira um versículo bíblico curto (máximo 2 versículos) sobre o tema "${tema}".
Retorne APENAS o versículo com a referência, sem explicações.
Exemplo: "Porque Deus amou o mundo de tal maneira... - João 3:16"`;

    const response = await gemini.generateResponse('system_devocional', prompt);
    return response || 'O Senhor é o meu pastor; nada me faltará. - Salmo 23:1';
}

/**
 * Gera reflexão personalizada
 * @param {object} usuario - Dados do usuário
 * @param {string} tema - Tema do devocional
 * @param {string} versiculo - Versículo base
 * @returns {string} Reflexão gerada
 */
async function gerarReflexao(usuario, tema, versiculo) {
    const contexto = construirContexto(usuario);

    const prompt = `Gere uma reflexão devocional curta e inspiradora (máximo 150 palavras).

TEMA: ${tema}
VERSÍCULO: ${versiculo}
${contexto}

A reflexão deve:
1. Ser pessoal e acolhedora
2. Conectar o versículo com a vida prática
3. Incluir uma aplicação simples para o dia
4. Terminar com uma breve oração ou bênção

Escreva como Jesus falaria: com amor, sabedoria e encorajamento.`;

    const response = await gemini.generateResponse('system_devocional', prompt);
    return response || 'Que a paz de Deus guarde seu coração hoje.';
}

/**
 * Constrói contexto do usuário para personalização
 * @param {object} usuario - Dados do usuário
 * @returns {string} Contexto formatado
 */
function construirContexto(usuario) {
    const partes = [];

    if (usuario.nome) {
        partes.push(`NOME: ${usuario.nome}`);
    }

    if (usuario.nivel) {
        partes.push(`NÍVEL ESPIRITUAL: ${usuario.nivel}`);
    }

    // Verifica jornada espiritual
    if (usuario.jornada_espiritual?.desafios) {
        partes.push(`DESAFIOS: ${usuario.jornada_espiritual.desafios}`);
    }

    return partes.length > 0 ? `\nCONTEXTO DO USUÁRIO:\n${partes.join('\n')}` : '';
}

/**
 * Envia devocionais para todos os usuários ativos
 * @param {function} sendFunction - Função para enviar mensagem
 * @returns {object} Resultado do envio
 */
export async function enviarDevocionalDiario(sendFunction) {
    const usuarios = db.getUsuariosDevocionalAtivo();
    const resultados = { enviados: 0, erros: 0 };

    console.log(`[Devocional] Iniciando envio para ${usuarios.length} usuários`);

    for (const usuario of usuarios) {
        try {
            // Verifica se já tem devocional hoje
            const devocionalExistente = db.getDevocionalHoje(usuario.id);

            let devocional;
            if (devocionalExistente) {
                devocional = devocionalExistente;
            } else {
                devocional = await gerarDevocional(usuario);
            }

            if (!devocional) {
                resultados.erros++;
                continue;
            }

            // Formata mensagem
            const mensagem = formatarDevocional(devocional, usuario.nome);

            // Envia
            await sendFunction(usuario.telefone, mensagem);
            resultados.enviados++;

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`[Devocional] Erro ao enviar para ${usuario.telefone}:`, error);
            resultados.erros++;
        }
    }

    console.log(`[Devocional] Envio concluído: ${resultados.enviados} enviados, ${resultados.erros} erros`);
    return resultados;
}

/**
 * Formata devocional para envio
 * @param {object} devocional - Dados do devocional
 * @param {string} nome - Nome do usuário
 * @returns {string} Mensagem formatada
 */
function formatarDevocional(devocional, nome) {
    const saudacao = nome ? `Bom dia, ${nome}!` : 'Bom dia!';

    return `${saudacao} 🌅

📖 *Devocional do Dia*
_Tema: ${capitalizar(devocional.tema)}_

✨ *${devocional.versiculo}*

${devocional.reflexao}

---
_Responda "li" quando terminar sua leitura_`;
}

/**
 * Capitaliza primeira letra
 * @param {string} str - String
 * @returns {string} String capitalizada
 */
function capitalizar(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

/**
 * Processa resposta do usuário ao devocional
 * @param {string} jid - WhatsApp JID
 * @param {string} texto - Texto da mensagem
 * @returns {object|null} Resposta ou null se não for sobre devocional
 */
export async function processarRespostaDevocional(jid, texto) {
    const textoLower = texto.toLowerCase().trim();

    // Ativar devocional
    if (textoLower.includes('quero receber devocional') ||
        textoLower.includes('ativar devocional') ||
        textoLower.includes('receber devocional')) {

        const sucesso = db.toggleDevocional(jid, true);
        return sucesso
            ? { tipo: 'ativado', mensagem: 'Devocional ativado! Você receberá uma reflexão todas as manhãs às 6h. Que Deus abençoe seus dias!' }
            : { tipo: 'erro', mensagem: 'Não consegui ativar o devocional. Tente novamente.' };
    }

    // Pausar devocional
    if (textoLower.includes('pausar devocional') ||
        textoLower.includes('parar devocional') ||
        textoLower.includes('desativar devocional')) {

        const sucesso = db.toggleDevocional(jid, false);
        return sucesso
            ? { tipo: 'pausado', mensagem: 'Devocional pausado. Quando quiser voltar a receber, é só me dizer!' }
            : { tipo: 'erro', mensagem: 'Não consegui pausar o devocional. Tente novamente.' };
    }

    // Marcar como lido
    if (textoLower === 'li' || textoLower === 'lido') {
        const usuario = db.getUsuario(jid);
        if (!usuario) return null;

        const devocional = db.getDevocionalHoje(usuario.id);
        if (devocional && !devocional.lido) {
            db.marcarDevocionalLido(devocional.id);
            return {
                tipo: 'lido',
                mensagem: 'Que bom que você fez sua leitura! Que a Palavra de Deus ilumine seu dia. 🙏'
            };
        }
    }

    return null;
}

/**
 * Verifica se mensagem é relacionada a devocional
 * @param {string} texto - Texto da mensagem
 * @returns {boolean}
 */
export function isDevocionalRelated(texto) {
    const keywords = ['devocional', 'leitura diária', 'li', 'lido'];
    const textoLower = texto.toLowerCase();
    return keywords.some(k => textoLower.includes(k));
}

export default {
    gerarDevocional,
    enviarDevocionalDiario,
    processarRespostaDevocional,
    isDevocionalRelated
};
