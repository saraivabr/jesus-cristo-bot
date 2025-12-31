/**
 * TEACHING ENGINE - 100% AI Generated
 * Motor de Ensino - Orquestra todo o sistema de ensino biblico
 * 
 * ATUALIZADO: Removeu templates. Usa Gemini para gerar ensinos contextualizados.
 */

import * as gemini from '../gemini.js';
import * as db from '../database.js'; // Assumindo necessidade de DB

// ============================================
// CONFIGURACAO
// ============================================
const CONFIG = {
  chanceEnsinoAutomatico: 0.4,
  chanceOferecer: 0.3,
  intervaloMinimo: 3,
};

const gatilhosEnsino = [
  /o que (e|significa) (fe|amor|perdao|oracao)/i,
  /como (eu )?(faco pra |posso )(orar|perdoar|ter fe|crer)/i,
  /me (ensina|explica|conta) sobre/i,
  /quem e (voce|jesus|deus)/i,
  /o que a biblia (diz|fala) sobre/i,
  /preciso de (uma palavra|ajuda|forca)/i,
  /nao aguento mais/i,
  /to no limite/i,
];

// ============================================
// AI GENERATION
// ============================================

async function generateTeachingContent(tema, tipo, perfil) {
    try {
        const prompt = `
        Você é Jesus ensinando um discípulo.
        Tema: ${tema || 'vida espiritual'}
        Tipo: ${tipo} (ex: parábola moderna, versículo explicado, memória vivida)
        Nível do aluno: ${perfil.nivel || 'iniciante'}
        
        Gere um ensinamento curto e impactante.
        Se for parábola, use contexto moderno (tecnologia, trabalho, cidade) se apropriado.
        Se for versículo, não apenas cite, explique como quem escreveu.
        
        Gere apenas o texto do ensino.
        `;

        const response = await gemini.generateResponse(
            'system_teaching_generator',
            prompt,
            { extraContext: "GERADOR DE ENSINO" },
            { skipEmotionalAnalysis: true }
        );
        return response;
    } catch (e) {
        console.error("Erro no ensino AI:", e);
        return null;
    }
}

async function generateChallengeContent(tema) {
    try {
        const prompt = `
        Gere um desafio prático e curto sobre: ${tema}.
        Formato: "Desafio: [ação]"
        `;
        return await gemini.generateResponse('system_challenge_gen', prompt, {}, {skipEmotionalAnalysis:true});
    } catch (e) { return null; }
}

// ============================================
// LOGICA DE CONTROLE
// ============================================

export function detectarTema(mensagem) {
    const temas = ['medo', 'ansiedade', 'perdao', 'fe', 'amor', 'trabalho', 'familia', 'proposito', 'culpa', 'oracao'];
    return temas.find(t => mensagem.toLowerCase().includes(t)) || null;
}

export function shouldTeach(userMessage, perfil, conversationHistory = []) {
    const ultimoEnsino = perfil.ultimo_ensino_index || 0;
    if ((conversationHistory.length - ultimoEnsino) < CONFIG.intervaloMinimo) return { should: false };

    for (const gatilho of gatilhosEnsino) {
        if (gatilho.test(userMessage)) {
            return { should: true, automatico: true, tema: detectarTema(userMessage) || 'fe' };
        }
    }

    const tema = detectarTema(userMessage);
    if (tema) {
        if (Math.random() < CONFIG.chanceEnsinoAutomatico) return { should: true, automatico: true, tema };
        if (Math.random() < (CONFIG.chanceEnsinoAutomatico + CONFIG.chanceOferecer)) return { should: true, automatico: false, oferecer: true, tema };
    }

    return { should: false };
}

export async function processarEnsino(userMessage, perfil, conversationHistory = []) {
    const result = shouldTeach(userMessage, perfil, conversationHistory);
    
    if (!result.should) return null;

    // Se deve oferecer
    if (result.oferecer) {
        return {
            tipo: 'oferta',
            fragments: [`Sinto que queres saber mais sobre ${result.tema}. Posso te ensinar algo sobre isso?`],
            tema: result.tema
        };
    }

    // Se deve ensinar automaticamente
    const tipo = Math.random() < 0.5 ? 'parabola' : 'versiculo';
    const conteudo = await generateTeachingContent(result.tema, tipo, perfil);

    if (!conteudo) return null;

    // Fragments para envio
    const fragments = [conteudo];

    return {
        tipo,
        fragments,
        tema: result.tema,
        updatePerfil: {
            ultimo_ensino_index: conversationHistory.length
        }
    };
}

export async function adicionarDesafio(fragments, tema, perfil) {
    const desafio = await generateChallengeContent(tema);
    if (desafio) fragments.push(desafio);
    return fragments;
}

export default {
    processarEnsino,
    adicionarDesafio,
    detectarTema,
    shouldTeach
};