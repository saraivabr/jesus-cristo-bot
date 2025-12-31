/**
 * TEACHING ENGINE
 * Motor de Ensino - Orquestra todo o sistema de ensino bíblico
 * Jesus ensina como Jesus ensinava
 */

import {
  versiculos,
  passagens,
  getVersiculoPorTema,
  getVersiculoPorHumor,
  getPassagemPorTema,
  getBeatitudeAleatoria,
  searchByKeyword
} from '../prompts/ensinamentos.js';

import {
  desafios,
  getDesafio,
  getDesafioPorNivel,
  formatarDesafio,
  getDesafioUrgente
} from '../prompts/desafios.js';

import {
  niveis,
  detectarNivel,
  getOrientacoes,
  gerarContextoNivel,
  getTopicos,
  getSaudacao
} from '../prompts/jornada.js';

import { getParabola, getAllParabolas, getParabolaForSituation } from '../prompts/parabolas.js';

// ============================================
// CONFIGURAÇÃO
// ============================================
const CONFIG = {
  // Chance de ensinar automaticamente (0-1)
  chanceEnsinoAutomatico: 0.4,

  // Chance de oferecer ensino em vez de dar automaticamente (0-1)
  chanceOferecer: 0.3,

  // Mensagens mínimas entre ensinos
  intervaloMinimo: 3,

  // Tipos de ensino disponíveis
  tiposEnsino: ['versiculo', 'parabola', 'passagem', 'pergunta', 'beatitude', 'desafio']
};

// ============================================
// DETECÇÃO DE TEMAS
// ============================================
const temasPorPalavra = {
  medo: ['medo', 'assustado', 'pavor', 'temor', 'com medo', 'tenho medo', 'receio'],
  ansiedade: ['ansioso', 'ansiedade', 'preocupado', 'nervoso', 'agoniado', 'angustiado', 'aflito'],
  tristeza: ['triste', 'tristeza', 'deprimido', 'depressão', 'chorando', 'chorar', 'infeliz', 'melancolia'],
  perdao: ['perdoar', 'perdão', 'mágoa', 'magoado', 'ressentimento', 'rancor', 'raiva'],
  fe: ['fé', 'acreditar', 'dúvida', 'duvidar', 'incerteza', 'crença'],
  amor: ['amor', 'amar', 'relacionamento', 'coração partido', 'desamor', 'solidão amorosa'],
  trabalho: ['trabalho', 'emprego', 'carreira', 'profissão', 'desemprego', 'chefe', 'salário'],
  familia: ['família', 'pai', 'mãe', 'filho', 'filha', 'marido', 'esposa', 'casamento', 'irmão'],
  dinheiro: ['dinheiro', 'dívida', 'financeiro', 'pobre', 'rico', 'grana', 'boleto', 'conta'],
  proposito: ['propósito', 'sentido', 'razão de viver', 'pra que eu existo', 'sem rumo', 'perdido'],
  solidao: ['sozinho', 'solidão', 'isolado', 'ninguém me entende', 'abandonado'],
  culpa: ['culpa', 'culpado', 'remorso', 'arrependido', 'vergonha', 'me arrependo'],
  duvida: ['dúvida', 'duvidar', 'não sei se', 'será que', 'incerto'],
  esperanca: ['esperança', 'esperar', 'futuro', 'amanhã', 'vai melhorar'],
  oracao: ['orar', 'oração', 'rezar', 'reza', 'falar com deus', 'conversar com deus'],
  tentacao: ['tentação', 'tentado', 'pecado', 'cair', 'fraqueza', 'vício'],
  paciencia: ['paciência', 'impaciente', 'esperar', 'demora', 'ansioso demais'],
  gratidao: ['grato', 'gratidão', 'agradecer', 'obrigado', 'abençoado']
};

// ============================================
// GATILHOS DE ENSINO
// ============================================
const gatilhosEnsino = [
  // Perguntas diretas sobre fé
  /o que (é|significa) (fé|amor|perdão|oração)/i,
  /como (eu )?(faço pra |posso )(orar|perdoar|ter fé|crer)/i,
  /me (ensina|explica|conta) sobre/i,
  /quem é (você|jesus|deus)/i,
  /o que a bíblia (diz|fala) sobre/i,
  /tem algum versículo/i,

  // Pedidos implícitos
  /preciso de (uma palavra|ajuda|força)/i,
  /me dá uma (palavra|luz|direção)/i,
  /to precisando (de força|ouvir)/i,

  // Estados emocionais intensos
  /não aguento mais/i,
  /to no limite/i,
  /não sei o que fazer/i,
  /me ajuda/i,
  /to perdido/i,
  /não tenho mais forças/i
];

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

/**
 * Detecta o tema principal da mensagem
 */
export function detectarTema(mensagem) {
  const msgLower = mensagem.toLowerCase();

  for (const [tema, palavras] of Object.entries(temasPorPalavra)) {
    for (const palavra of palavras) {
      if (msgLower.includes(palavra)) {
        return tema;
      }
    }
  }

  return null;
}

/**
 * Verifica se é momento de ensinar
 */
export function shouldTeach(userMessage, perfil = {}, conversationHistory = []) {
  // Verifica se passou do intervalo mínimo desde o último ensino
  const ultimoEnsino = perfil.ultimo_ensino_index || 0;
  const mensagensDesdeUltimoEnsino = conversationHistory.length - ultimoEnsino;

  if (mensagensDesdeUltimoEnsino < CONFIG.intervaloMinimo) {
    return { should: false, reason: 'intervalo_minimo' };
  }

  // Verifica gatilhos de ensino (perguntas diretas, etc)
  for (const gatilho of gatilhosEnsino) {
    if (gatilho.test(userMessage)) {
      return {
        should: true,
        reason: 'gatilho_direto',
        automatico: true,
        tema: detectarTema(userMessage)
      };
    }
  }

  // Verifica se tem tema detectável
  const tema = detectarTema(userMessage);

  if (tema) {
    // Decide se ensina automaticamente ou oferece
    const random = Math.random();

    if (random < CONFIG.chanceEnsinoAutomatico) {
      return {
        should: true,
        reason: 'tema_detectado',
        automatico: true,
        tema
      };
    } else if (random < CONFIG.chanceEnsinoAutomatico + CONFIG.chanceOferecer) {
      return {
        should: true,
        reason: 'tema_detectado',
        automatico: false,
        oferecer: true,
        tema
      };
    }
  }

  return { should: false, reason: 'nao_detectado' };
}

/**
 * Seleciona o tipo de ensino apropriado
 */
export function selectTeachingType(context) {
  const { tema, nivel, humor, mensagem } = context;

  // Se a pessoa perguntou sobre algo específico, prioriza resposta direta
  if (mensagem && /o que (é|significa)/i.test(mensagem)) {
    return 'versiculo';
  }

  // Se perguntou por história ou parábola
  if (mensagem && /(história|parábola|conta)/i.test(mensagem)) {
    return 'parabola';
  }

  // Se está muito pesado, versículo curto
  if (humor === 'triste' || humor === 'ansioso') {
    return Math.random() < 0.6 ? 'versiculo' : 'parabola';
  }

  // Baseado no nível
  if (nivel === 'curioso' || nivel === 'buscador') {
    // Mais histórias pra quem tá começando
    return Math.random() < 0.7 ? 'parabola' : 'versiculo';
  }

  // Distribuição normal
  const tipos = ['versiculo', 'parabola', 'passagem', 'beatitude'];
  return tipos[Math.floor(Math.random() * tipos.length)];
}

/**
 * Busca o conteúdo de ensino
 */
export function getTeaching(type, context) {
  const { tema, nivel } = context;

  switch (type) {
    case 'versiculo':
      return tema ? getVersiculoPorTema(tema) : getVersiculoPorHumor(context.humor || 'neutro');

    case 'parabola':
      if (tema) {
        const p = getParabola(tema);
        if (p) return p;
      }
      // Retorna parábola aleatória
      const todas = getAllParabolas();
      return todas[Math.floor(Math.random() * todas.length)];

    case 'passagem':
      return tema ? getPassagemPorTema(tema) : null;

    case 'beatitude':
      return getBeatitudeAleatoria();

    case 'desafio':
      return getDesafio(tema || 'geral', { nivel });

    default:
      return null;
  }
}

/**
 * Formata o ensino no estilo de Jesus (curto, fragmentado)
 */
export function formatTeaching(content, type) {
  if (!content) return null;

  const fragments = [];

  switch (type) {
    case 'versiculo':
      // Formato: aplicação primeiro, depois referência
      if (content.aplicacao) {
        fragments.push(content.aplicacao);
      }
      if (content.texto) {
        fragments.push(`_"${content.texto}"_`);
      }
      if (content.ref) {
        fragments.push(`${content.ref}`);
      }
      if (content.pergunta) {
        fragments.push(content.pergunta);
      }
      break;

    case 'parabola':
      // Parábolas são contadas em fragmentos
      if (content.titulo) {
        fragments.push(`Deixa eu te contar uma história.`);
      }
      if (content.resumo) {
        // Divide a parábola em partes menores
        const partes = content.resumo.split('\n\n').filter(p => p.trim());
        fragments.push(...partes);
      }
      if (content.aplicacao) {
        fragments.push(content.aplicacao);
      }
      if (content.pergunta) {
        fragments.push(content.pergunta);
      }
      break;

    case 'passagem':
      if (content.titulo) {
        fragments.push(`Vou te contar sobre ${content.titulo}.`);
      }
      if (content.resumo) {
        const partes = content.resumo.split('\n\n').filter(p => p.trim());
        fragments.push(...partes);
      }
      if (content.aplicacao) {
        fragments.push(content.aplicacao);
      }
      if (content.pergunta) {
        fragments.push(content.pergunta);
      }
      break;

    case 'beatitude':
      fragments.push(content.moderno);
      fragments.push(`_"${content.original}"_`);
      if (content.pergunta) {
        fragments.push(content.pergunta);
      }
      break;

    case 'desafio':
      fragments.push(formatarDesafio(content));
      break;

    default:
      if (typeof content === 'string') {
        fragments.push(content);
      }
  }

  return fragments.filter(f => f && f.trim());
}

/**
 * Gera oferecimento de ensino (quando não é automático)
 */
export function getOferta(tema) {
  const ofertas = {
    default: [
      "Quer que eu te conte uma história sobre isso?",
      "Posso te mostrar o que a Palavra diz sobre isso.",
      "Tem algo que quero te ensinar. Quer ouvir?",
      "Eu tenho uma história pra isso. Quer ouvir?"
    ],
    medo: [
      "Quer que eu te conte sobre quando meus discípulos tiveram medo no barco?",
      "Posso te mostrar o que eu disse sobre medo."
    ],
    ansiedade: [
      "Eu falei muito sobre ansiedade. Quer ouvir?",
      "Tem uma coisa que eu disse no monte sobre preocupação. Quer saber?"
    ],
    tristeza: [
      "Eu também chorei. Quer que eu te conte?",
      "Tenho uma palavra pra quem tá triste. Posso compartilhar?"
    ],
    perdao: [
      "Pedro me perguntou sobre perdão uma vez. Quer saber o que eu disse?",
      "Eu tenho uma história sobre perdão. Quer ouvir?"
    ]
  };

  const lista = ofertas[tema] || ofertas.default;
  return lista[Math.floor(Math.random() * lista.length)];
}

/**
 * Gera contexto de ensino pro prompt do Gemini
 */
export function gerarContextoEnsino(perfil, historicoRecente = []) {
  const nivel = detectarNivel(perfil, historicoRecente);
  const orientacoes = getOrientacoes(nivel);
  const topicos = getTopicos(nivel);

  let contexto = gerarContextoNivel(nivel);

  // Adiciona tópicos sugeridos
  contexto += `\n\nTÓPICOS APROPRIADOS PARA ESSE NÍVEL:\n`;
  contexto += topicos.map(t => `- ${t}`).join('\n');

  // Adiciona histórico de ensinos (pra não repetir)
  if (perfil.ensinos_recentes && perfil.ensinos_recentes.length > 0) {
    contexto += `\n\nENSINOS RECENTES (NÃO REPETIR):\n`;
    contexto += perfil.ensinos_recentes.slice(-5).map(e => `- ${e}`).join('\n');
  }

  return contexto;
}

/**
 * Adiciona desafio ao final da resposta
 */
export function adicionarDesafio(fragments, tema, perfil = {}) {
  const desafio = getDesafio(tema || 'geral', perfil);

  if (desafio) {
    const desafioFormatado = formatarDesafio(desafio);
    // Divide o desafio em fragmentos
    const partesDesafio = desafioFormatado.split('\n\n').filter(p => p.trim());
    fragments.push(...partesDesafio);
  }

  return fragments;
}

/**
 * Processa ensino completo: detecta, seleciona, formata
 */
export function processarEnsino(userMessage, perfil, conversationHistory = []) {
  // Verifica se deve ensinar
  const shouldResult = shouldTeach(userMessage, perfil, conversationHistory);

  if (!shouldResult.should) {
    return null;
  }

  // Se deve oferecer em vez de dar automaticamente
  if (shouldResult.oferecer) {
    return {
      tipo: 'oferta',
      fragments: [getOferta(shouldResult.tema)],
      tema: shouldResult.tema
    };
  }

  // Seleciona tipo de ensino
  const context = {
    tema: shouldResult.tema,
    nivel: perfil.nivel || detectarNivel(perfil, conversationHistory),
    humor: perfil.humor || 'neutro',
    mensagem: userMessage
  };

  const tipo = selectTeachingType(context);
  const conteudo = getTeaching(tipo, context);

  if (!conteudo) {
    return null;
  }

  const fragments = formatTeaching(conteudo, tipo);

  return {
    tipo,
    fragments,
    tema: shouldResult.tema,
    conteudo
  };
}

/**
 * Integra ensino com resposta do Gemini
 */
export function integrarComResposta(geminiResponse, ensino, incluirDesafio = true) {
  if (!ensino || !ensino.fragments) {
    return geminiResponse;
  }

  // Divide a resposta do Gemini em fragmentos
  let fragments = geminiResponse.split('\n\n').filter(f => f.trim());

  // Adiciona os fragmentos do ensino
  fragments.push(...ensino.fragments);

  // Adiciona desafio se solicitado
  if (incluirDesafio && ensino.tema) {
    const desafio = getDesafio(ensino.tema);
    if (desafio) {
      fragments.push('');
      fragments.push(formatarDesafio(desafio));
    }
  }

  return fragments;
}

// ============================================
// EXPORTAÇÕES
// ============================================
export default {
  // Detecção
  detectarTema,
  shouldTeach,

  // Seleção
  selectTeachingType,
  getTeaching,

  // Formatação
  formatTeaching,
  getOferta,

  // Contexto
  gerarContextoEnsino,

  // Processamento completo
  processarEnsino,
  adicionarDesafio,
  integrarComResposta,

  // Configuração
  CONFIG
};
