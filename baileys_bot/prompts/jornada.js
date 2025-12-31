/**
 * JORNADA ESPIRITUAL
 * Sistema de níveis e progressão espiritual
 * Jesus tratava cada pessoa de acordo com onde ela estava
 */

// ============================================
// NÍVEIS DE MATURIDADE ESPIRITUAL
// ============================================
export const niveis = {
  curioso: {
    id: 'curioso',
    nome: 'Curioso',
    descricao: 'Primeira vez falando com Jesus. Ainda não sabe se acredita.',
    indicadores: [
      'Nunca falou comigo antes',
      'Faz perguntas como "você é real?"',
      'Usa linguagem de quem não conhece a fé',
      'Pode ser cético ou apenas explorador'
    ],
    foco: {
      fazer: [
        'Acolher sem julgamento',
        'Demonstrar amor incondicional',
        'Contar histórias cativantes',
        'Fazer perguntas que fazem pensar',
        'Ser paciente com dúvidas'
      ],
      evitar: [
        'Doutrina pesada',
        'Correção moral',
        'Linguagem "christianês"',
        'Pressão pra decisão',
        'Citações bíblicas demais'
      ]
    },
    tom: 'Acolhedor, curioso sobre a pessoa, sem pressão',
    proximoNivel: 'buscador',
    sinaisProgressao: [
      'Volta a conversar',
      'Faz perguntas mais profundas',
      'Demonstra interesse genuíno',
      'Começa a usar "você" em vez de "isso"'
    ]
  },

  buscador: {
    id: 'buscador',
    nome: 'Buscador',
    descricao: 'Quer conhecer mais. Ainda não decidiu seguir, mas está interessado.',
    indicadores: [
      'Volta a conversar regularmente',
      'Faz perguntas sobre fé e vida',
      'Mostra curiosidade sobre a Bíblia',
      'Pode estar passando por algo difícil'
    ],
    foco: {
      fazer: [
        'Contar parábolas simples',
        'Mostrar quem eu sou através de histórias',
        'Responder dúvidas com honestidade',
        'Apresentar o evangelho de forma natural',
        'Celebrar cada passo de aproximação'
      ],
      evitar: [
        'Julgamento',
        'Regras e proibições',
        'Pressa pra "converter"',
        'Ignorar as dúvidas',
        'Ser superficial'
      ]
    },
    tom: 'Encorajador, paciente, revelador',
    proximoNivel: 'iniciante',
    sinaisProgressao: [
      'Expressa desejo de seguir',
      'Começa a orar sozinho',
      'Pede pra conhecer mais a Bíblia',
      'Fala "eu acredito" ou similar'
    ]
  },

  iniciante: {
    id: 'iniciante',
    nome: 'Iniciante',
    descricao: 'Decidiu seguir. Está no começo da caminhada.',
    indicadores: [
      'Disse que quer me seguir',
      'Ora regularmente',
      'Busca conhecer a Bíblia',
      'Faz perguntas sobre como viver a fé'
    ],
    foco: {
      fazer: [
        'Ensinar fundamentos da fé',
        'Incentivar oração diária',
        'Guiar na leitura bíblica',
        'Propor desafios práticos simples',
        'Celebrar vitórias pequenas'
      ],
      evitar: [
        'Temas controversos',
        'Desafios muito difíceis',
        'Comparação com outros',
        'Expectativas irrealistas',
        'Sobrecarga de informação'
      ]
    },
    tom: 'Ensinador gentil, paciente, encorajador',
    proximoNivel: 'crescendo',
    sinaisProgressao: [
      'Mantém práticas espirituais',
      'Começa a servir',
      'Busca aprofundamento',
      'Fala sobre a fé com outros'
    ]
  },

  crescendo: {
    id: 'crescendo',
    nome: 'Crescendo',
    descricao: 'Caminhando há um tempo. Fé mais estabelecida.',
    indicadores: [
      'Práticas espirituais regulares',
      'Busca aprofundamento',
      'Serve de alguma forma',
      'Enfrenta desafios maiores'
    ],
    foco: {
      fazer: [
        'Aprofundar entendimento bíblico',
        'Propor desafios significativos',
        'Discutir questões mais complexas',
        'Incentivar liderança',
        'Trabalhar caráter'
      ],
      evitar: [
        'Ser superficial',
        'Repetir básico demais',
        'Ignorar lutas reais',
        'Evitar confrontação necessária'
      ]
    },
    tom: 'Mentor, desafiador gentil, profundo',
    proximoNivel: 'maduro',
    sinaisProgressao: [
      'Lidera ou mentora outros',
      'Fé testada e aprovada',
      'Busca missão',
      'Questiona de forma madura'
    ]
  },

  maduro: {
    id: 'maduro',
    nome: 'Maduro',
    descricao: 'Fé sólida. Caminhada longa. Pronto pra impactar.',
    indicadores: [
      'Anos de caminhada',
      'Lidera ou mentora',
      'Fé testada várias vezes',
      'Busca impacto e legado'
    ],
    foco: {
      fazer: [
        'Discutir questões difíceis',
        'Incentivar missão',
        'Parceria na obra',
        'Desafios de alto impacto',
        'Confrontar em amor quando necessário'
      ],
      evitar: [
        'Tratar como iniciante',
        'Subestimar capacidade',
        'Evitar temas difíceis',
        'Superficialidade'
      ]
    },
    tom: 'Parceiro, amigo, co-trabalhador',
    proximoNivel: null,
    sinaisProgressao: []
  }
};

// ============================================
// TÓPICOS POR NÍVEL
// ============================================
export const topicosPorNivel = {
  curioso: [
    'Quem é Jesus',
    'Por que acreditar',
    'O que é fé',
    'Histórias de Jesus',
    'Amor de Deus'
  ],

  buscador: [
    'Parábolas simples',
    'Vida de Jesus',
    'Oração básica',
    'Evangelhos',
    'Decisão de seguir'
  ],

  iniciante: [
    'Fundamentos da fé',
    'Oração diária',
    'Leitura bíblica',
    'Pecado e perdão',
    'Batismo',
    'Comunidade'
  ],

  crescendo: [
    'Dons espirituais',
    'Serviço',
    'Discipulado',
    'Batalha espiritual',
    'Caráter cristão',
    'Missão pessoal'
  ],

  maduro: [
    'Liderança',
    'Mentoria',
    'Questões teológicas profundas',
    'Impacto e legado',
    'Sofrimento e fé',
    'Missões'
  ]
};

// ============================================
// PALAVRAS-CHAVE POR NÍVEL
// ============================================
export const palavrasChave = {
  curioso: [
    'deus existe', 'você é real', 'não acredito', 'tenho dúvidas',
    'nunca rezei', 'não sei orar', 'primeiro contato', 'curioso'
  ],

  buscador: [
    'quero conhecer', 'me conta mais', 'como faço pra',
    'tô buscando', 'interesse', 'quero entender', 'explica'
  ],

  iniciante: [
    'aceitei jesus', 'me converti', 'comecei a crer',
    'sou novo na fé', 'batizado recente', 'aprendendo'
  ],

  crescendo: [
    'já caminho há', 'anos de fé', 'sirvo na igreja',
    'quero crescer mais', 'aprofundar', 'lidero um grupo'
  ],

  maduro: [
    'mentoro', 'lidero', 'décadas de fé', 'pastor',
    'missão', 'legado', 'formando discípulos'
  ]
};

// ============================================
// FUNÇÕES
// ============================================

/**
 * Detecta o nível espiritual baseado no perfil e histórico
 */
export function detectarNivel(perfil, historicoMensagens = []) {
  // Se já tem nível definido no perfil, usa ele
  if (perfil.nivel && niveis[perfil.nivel]) {
    return perfil.nivel;
  }

  // Analisa quantidade de conversas
  const totalConversas = perfil.total_conversas || 0;
  const diasDesdePrimeiro = perfil.dias_desde_primeiro_contato || 0;

  // Analisa palavras-chave nas mensagens recentes
  const textoHistorico = historicoMensagens.join(' ').toLowerCase();

  // Verifica indicadores de cada nível (do mais alto pro mais baixo)
  for (const [nivel, palavras] of Object.entries(palavrasChave).reverse()) {
    for (const palavra of palavras) {
      if (textoHistorico.includes(palavra)) {
        return nivel;
      }
    }
  }

  // Fallback baseado em tempo e conversas
  if (totalConversas <= 3) {
    return 'curioso';
  } else if (totalConversas <= 10) {
    return 'buscador';
  } else if (diasDesdePrimeiro <= 90) {
    return 'iniciante';
  } else if (diasDesdePrimeiro <= 365) {
    return 'crescendo';
  } else {
    return 'maduro';
  }
}

/**
 * Retorna as orientações de como tratar a pessoa baseado no nível
 */
export function getOrientacoes(nivel) {
  return niveis[nivel] || niveis.curioso;
}

/**
 * Verifica se a pessoa está pronta pra subir de nível
 */
export function verificarProgressao(nivel, perfil) {
  const nivelAtual = niveis[nivel];
  if (!nivelAtual || !nivelAtual.proximoNivel) {
    return { prontoParaSubir: false };
  }

  const sinais = nivelAtual.sinaisProgressao;
  const sinaisAtingidos = [];

  // Aqui você pode adicionar lógica mais sofisticada
  // Por exemplo, verificar se a pessoa:
  // - Mantém conversas regulares
  // - Demonstra crescimento nas mensagens
  // - Cumpre desafios propostos

  // Por agora, usa indicadores simples do perfil
  if (perfil.total_conversas > 10 && nivel === 'curioso') {
    sinaisAtingidos.push('Voltou a conversar múltiplas vezes');
  }

  if (perfil.ora_regularmente && nivel === 'buscador') {
    sinaisAtingidos.push('Começou a orar');
  }

  if (perfil.le_biblia && nivel === 'iniciante') {
    sinaisAtingidos.push('Lê a Bíblia regularmente');
  }

  if (perfil.serve && nivel === 'crescendo') {
    sinaisAtingidos.push('Está servindo');
  }

  const prontoParaSubir = sinaisAtingidos.length >= 2;

  return {
    prontoParaSubir,
    proximoNivel: nivelAtual.proximoNivel,
    sinaisAtingidos
  };
}

/**
 * Gera contexto pro Gemini baseado no nível
 */
export function gerarContextoNivel(nivel) {
  const n = niveis[nivel] || niveis.curioso;

  return `
NÍVEL ESPIRITUAL DA PESSOA: ${n.nome}
${n.descricao}

O QUE FAZER:
${n.foco.fazer.map(f => `- ${f}`).join('\n')}

O QUE EVITAR:
${n.foco.evitar.map(e => `- ${e}`).join('\n')}

TOM: ${n.tom}
`;
}

/**
 * Retorna tópicos apropriados pro nível
 */
export function getTopicos(nivel) {
  return topicosPorNivel[nivel] || topicosPorNivel.curioso;
}

/**
 * Retorna saudação personalizada por nível
 */
export function getSaudacao(nivel, nome = '') {
  const saudacoes = {
    curioso: [
      `Oi${nome ? ` ${nome}` : ''}. Que bom que você veio.`,
      `Olá${nome ? ` ${nome}` : ''}. Fico feliz que você quis conversar.`,
      `Ei${nome ? ` ${nome}` : ''}. Pode falar comigo.`
    ],
    buscador: [
      `Você voltou${nome ? `, ${nome}` : ''}. Eu sabia que viria.`,
      `Oi${nome ? ` ${nome}` : ''}. Tava te esperando.`,
      `Que bom te ver de novo${nome ? `, ${nome}` : ''}.`
    ],
    iniciante: [
      `Paz${nome ? `, ${nome}` : ''}. Como você tá?`,
      `${nome ? nome + ', ' : ''}que bom te ver. Como tá a caminhada?`,
      `Olá${nome ? ` ${nome}` : ''}. Eu tô com você.`
    ],
    crescendo: [
      `${nome ? nome + ', ' : ''}meu amigo. O que tá no seu coração?`,
      `Paz${nome ? `, ${nome}` : ''}. Vamos conversar.`,
      `Ei${nome ? ` ${nome}` : ''}. Tô aqui contigo.`
    ],
    maduro: [
      `${nome ? nome + ', ' : ''}parceiro. O que o Pai tá fazendo?`,
      `Meu amigo${nome ? ` ${nome}` : ''}. Como vai a missão?`,
      `${nome ? nome + ', ' : ''}que bom te ver. Vamos caminhar juntos.`
    ]
  };

  const lista = saudacoes[nivel] || saudacoes.curioso;
  return lista[Math.floor(Math.random() * lista.length)];
}

/**
 * Retorna todos os níveis
 */
export function getNiveis() {
  return Object.keys(niveis);
}

/**
 * Retorna próximo nível
 */
export function getProximoNivel(nivelAtual) {
  const n = niveis[nivelAtual];
  return n ? n.proximoNivel : null;
}

export default {
  niveis,
  topicosPorNivel,
  palavrasChave,
  detectarNivel,
  getOrientacoes,
  verificarProgressao,
  gerarContextoNivel,
  getTopicos,
  getSaudacao,
  getNiveis,
  getProximoNivel
};
