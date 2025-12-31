/**
 * Parábolas Modernas - Mensagens de Sabedoria para o Contexto Atual
 *
 * Este módulo contém parábolas modernas organizadas por tema,
 * com funções para buscar parábolas relevantes baseadas em contexto.
 */

const parabolas = [
  // REDES SOCIAIS
  {
    tema: 'redes_sociais',
    titulo: 'O Jardineiro das Curtidas',
    texto: `Havia um jardineiro que passava o dia inteiro fotografando suas flores para mostrar aos vizinhos,
mas nunca as regava. Um dia, todas morreram. Ele percebeu então que tinha mais fotos de flores
do que flores reais.

Assim é com aquele que vive apenas para mostrar sua vida nas redes sociais:
coleciona curtidas, mas esquece de cultivar experiências verdadeiras.

"Não acumulem para vocês tesouros na terra... mas acumulem para vocês tesouros no céu" (Mateus 6:19-20)

Que sua vida real seja mais rica que sua vida virtual.`,
    keywords: ['redes_sociais', 'instagram', 'facebook', 'curtidas', 'likes', 'foto', 'aparência', 'vaidade']
  },
  {
    tema: 'redes_sociais',
    titulo: 'A Comparação do Espelho Quebrado',
    texto: `Uma jovem olhava para os espelhos de sua casa e se sentia bem. Mas quando começou a olhar
através dos espelhos das casas dos outros nas redes sociais, seu reflexo pareceu quebrado e feio.

Ela não havia mudado - apenas começou a se medir pela régua dos outros.

"Não nos comparemos uns aos outros, pois cada um levará a sua própria carga" (Gálatas 6:4-5)

Você é único na criação de Deus. Não se compare com a vitrine editada da vida alheia.`,
    keywords: ['comparação', 'inveja', 'autoestima', 'redes_sociais', 'depressão', 'ansiedade', 'inadequado']
  },

  // TRABALHO
  {
    tema: 'trabalho',
    titulo: 'O Pedreiro e as Catedrais',
    texto: `Três pedreiros trabalhavam lado a lado. Quando perguntados o que faziam,
o primeiro disse: "Estou assentando tijolos."
O segundo disse: "Estou ganhando meu sustento."
O terceiro disse: "Estou construindo uma catedral para a glória de Deus."

Todos faziam o mesmo trabalho, mas apenas um encontrou propósito.

"Tudo o que fizerem, façam de todo o coração, como para o Senhor" (Colossenses 3:23)

Seu trabalho não é apenas um emprego - é um chamado. Faça-o com excelência.`,
    keywords: ['trabalho', 'emprego', 'propósito', 'carreira', 'motivação', 'sentido', 'vocação']
  },
  {
    tema: 'trabalho',
    titulo: 'A Escada Apoiada na Parede Errada',
    texto: `Um homem subiu a escada do sucesso com determinação. Trabalhou dias e noites,
sacrificou família e saúde. Quando chegou ao topo, percebeu que a escada estava
apoiada na parede errada.

Ele havia alcançado o que não queria, perdendo o que mais amava.

"Pois que adianta ao homem ganhar o mundo inteiro e perder a sua alma?" (Marcos 8:36)

Antes de subir, certifique-se de que sua escada está apoiada na parede certa.`,
    keywords: ['sucesso', 'trabalho', 'prioridades', 'família', 'ambição', 'carreira', 'workaholic']
  },

  // ANSIEDADE
  {
    tema: 'ansiedade',
    titulo: 'O Homem que Carregava Amanhã',
    texto: `Um homem carregava uma mochila pesadíssima. Dentro dela, guardava todos os problemas
que PODERIAM acontecer amanhã: "E se eu perder o emprego? E se ficar doente? E se...?"

A mochila era tão pesada que ele não conseguia caminhar hoje.

Quando finalmente a abriu, descobriu que 90% dos problemas nunca aconteceram.

"Não se preocupem com o amanhã, pois o amanhã trará suas próprias preocupações.
Basta a cada dia o seu próprio mal." (Mateus 6:34)

Deixe o amanhã com Deus. Ele já está lá.`,
    keywords: ['ansiedade', 'preocupação', 'futuro', 'medo', 'estresse', 'angústia', 'pânico']
  },
  {
    tema: 'ansiedade',
    titulo: 'O Pássaro na Gaiola Aberta',
    texto: `Um pássaro viveu tanto tempo em uma gaiola que, quando a porta foi aberta,
ele não saiu. Tinha medo do céu aberto, do desconhecido, da liberdade.

Ele preferiu a prisão conhecida à liberdade desconhecida.

Muitos vivem assim: presos na gaiola da ansiedade, com medo de confiar em Deus.

"Lancem sobre Ele toda a sua ansiedade, porque Ele tem cuidado de vocês" (1 Pedro 5:7)

A porta está aberta. Deus está chamando você para voar. Confie.`,
    keywords: ['ansiedade', 'medo', 'controle', 'confiança', 'fé', 'libertação', 'prisão']
  },

  // RELACIONAMENTOS
  {
    tema: 'relacionamentos',
    titulo: 'O Espinho e a Rosa',
    texto: `Uma mulher só via os espinhos do marido: ele era teimoso, calado, desorganizado.
Vivia reclamando dos espinhos.

Um dia, uma amiga lhe perguntou: "E as rosas? Ele não é trabalhador, fiel, pai dedicado?"

Ela estava tão focada nos espinhos que havia esquecido das rosas.

"O amor cobre multidão de pecados" (1 Pedro 4:8)

Em todo relacionamento há espinhos e rosas. Você escolhe no que focar.`,
    keywords: ['relacionamento', 'casamento', 'amor', 'defeitos', 'aceitação', 'crítica', 'parceiro']
  },
  {
    tema: 'relacionamentos',
    titulo: 'Os Dois Porcos-Espinhos',
    texto: `Em uma noite fria, dois porcos-espinhos tentavam se aquecer.
Quando se aproximavam demais, os espinhos machucavam um ao outro.
Quando se afastavam demais, sentiam frio.

Até que encontraram a distância perfeita: perto o suficiente para se aquecer,
longe o suficiente para não se ferir.

"Suportem-se uns aos outros em amor" (Efésios 4:2)

Relacionamentos saudáveis precisam de equilíbrio: intimidade sem sufocar,
espaço sem abandonar.`,
    keywords: ['relacionamento', 'limites', 'espaço', 'intimidade', 'equilíbrio', 'respeito', 'convivência']
  },

  // DINHEIRO
  {
    tema: 'dinheiro',
    titulo: 'O Homem Rico e o Barco Furado',
    texto: `Um homem ficou rico vendendo barcos. Tinha mansão, carros, tudo que queria.
Mas quando quis atravessar o rio da morte, descobriu que dinheiro não compra barco para essa viagem.

Toda sua riqueza ficou na margem. Ele atravessou de mãos vazias.

"Porque nada trouxemos para este mundo e dele nada podemos levar" (1 Timóteo 6:7)

Invista no que você pode levar: amor, fé, relacionamentos, caráter.`,
    keywords: ['dinheiro', 'riqueza', 'materialismo', 'morte', 'eternidade', 'prioridades', 'valores']
  },
  {
    tema: 'dinheiro',
    titulo: 'O Poço sem Fundo',
    texto: `Um homem tentava encher um poço sem fundo com dinheiro.
"Quando eu tiver mais 10 mil, estarei satisfeito", dizia.
Conseguiu. Mas o poço continuava vazio.
"Só mais 50 mil..." Conseguiu. Poço vazio.
"Mais 100 mil..." E assim foi até morrer, tentando encher o que não podia ser cheio.

O poço sem fundo era seu coração. E dinheiro não preenche vazios espirituais.

"Quem ama o dinheiro jamais dele se fartará" (Eclesiastes 5:10)

Você não precisa de mais dinheiro. Você precisa de mais Deus.`,
    keywords: ['dinheiro', 'ganância', 'satisfação', 'contentamento', 'materialismo', 'vazio', 'ambição']
  },

  // FAMÍLIA
  {
    tema: 'familia',
    titulo: 'As Pedras no Pote',
    texto: `Um pai mostrou ao filho um pote vazio: "Isso é sua vida."
Colocou pedras grandes: "Família."
Cascalhos médios: "Trabalho."
Areia: "Redes sociais, TV, etc."

Depois esvaziou e tentou fazer ao contrário: começou com areia.
As pedras não couberam mais.

"Se não colocar primeiro o que é importante, não haverá espaço para isso."

"Mas buscai primeiro o Reino de Deus" (Mateus 6:33)

Coloque as pedras grandes primeiro: Deus, família, saúde. O resto se encaixa.`,
    keywords: ['família', 'prioridades', 'tempo', 'filhos', 'valores', 'urgente', 'importante']
  },
  {
    tema: 'familia',
    titulo: 'O Relógio que não Volta',
    texto: `Um pai rico comprou um relógio de ouro para o filho. Mas nunca teve tempo para brincar com ele.
Quando o filho cresceu, o pai finalmente tinha tempo.
Mas o filho, agora, não tinha tempo para o pai.

O pai olhou para o relógio de ouro e percebeu: o ponteiro só gira para frente.
Ele não conseguiu comprar de volta os anos perdidos.

"Veja, ensine seus filhos no caminho em que devem andar" (Provérbios 22:6)

Tempo perdido com os filhos é tempo perdido para sempre. Não se recupera.`,
    keywords: ['família', 'filhos', 'tempo', 'arrependimento', 'infância', 'pai', 'mãe', 'ausência']
  },

  // FÉ
  {
    tema: 'fe',
    titulo: 'A Âncora Invisível',
    texto: `Um barco estava firme durante uma tempestade violenta.
As pessoas na praia não entendiam: "Como ele não vira?"

Não viam a âncora. Ela estava debaixo d'água, invisível, mas segurando o barco.

Assim é a fé: invisível aos olhos, mas é o que nos segura nas tempestades da vida.

"A fé é a certeza daquilo que esperamos e a prova das coisas que não vemos" (Hebreus 11:1)

Sua âncora está firme? Ou você está à deriva?`,
    keywords: ['fé', 'confiança', 'tempestade', 'provação', 'dificuldade', 'crise', 'firmeza']
  },
  {
    tema: 'fe',
    titulo: 'O Homem na Ponte',
    texto: `Um homem atravessava uma ponte de cordas sobre um abismo.
No meio, a ponte balançou violentamente. Ele entrou em pânico e agarrou as cordas.

Uma voz disse: "Solte e confie na ponte."
"Mas vou cair!"
"A ponte te segura. Suas mãos fracas, não. Solte."

Quando soltou, atravessou em paz. A ponte sempre o sustentou - mas ele precisou confiar.

"Confie no Senhor de todo o seu coração e não se apoie na sua própria inteligência" (Provérbios 3:5)

Pare de tentar se segurar. Deixe Deus te segurar.`,
    keywords: ['fé', 'confiança', 'controle', 'entrega', 'medo', 'rendição', 'segurança']
  }
];

/**
 * Retorna uma parábola aleatória de um tema específico
 * @param {string} tema - O tema desejado (redes_sociais, trabalho, ansiedade, relacionamentos, dinheiro, familia, fe)
 * @returns {Object|null} Objeto com a parábola ou null se não encontrada
 */
export function getParabola(tema) {
  const parabolasDoTema = parabolas.filter(p => p.tema === tema);

  if (parabolasDoTema.length === 0) {
    return null;
  }

  const indiceAleatorio = Math.floor(Math.random() * parabolasDoTema.length);
  return parabolasDoTema[indiceAleatorio];
}

/**
 * Encontra a parábola mais relevante baseada em palavras-chave
 * @param {string[]} keywords - Array de palavras-chave para buscar
 * @returns {Object|null} Parábola mais relevante ou null se não encontrada
 */
export function getParabolaForSituation(keywords) {
  if (!keywords || keywords.length === 0) {
    return null;
  }

  // Normaliza keywords para lowercase
  const normalizedKeywords = keywords.map(k => k.toLowerCase());

  // Calcula pontuação para cada parábola baseada em correspondência de keywords
  const parabolasComScore = parabolas.map(parabola => {
    let score = 0;

    normalizedKeywords.forEach(keyword => {
      // Verifica se a keyword está nas keywords da parábola
      if (parabola.keywords.some(pk => pk.includes(keyword) || keyword.includes(pk))) {
        score += 2; // Peso maior para match nas keywords definidas
      }

      // Verifica se a keyword está no texto da parábola
      if (parabola.texto.toLowerCase().includes(keyword)) {
        score += 1;
      }

      // Verifica se a keyword está no título
      if (parabola.titulo.toLowerCase().includes(keyword)) {
        score += 1;
      }
    });

    return {
      ...parabola,
      score
    };
  });

  // Filtra parábolas com score > 0 e ordena por score
  const parabolasRelevantes = parabolasComScore
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);

  if (parabolasRelevantes.length === 0) {
    return null;
  }

  // Se houver múltiplas parábolas com o mesmo score máximo, escolhe aleatoriamente entre elas
  const maxScore = parabolasRelevantes[0].score;
  const topParabolas = parabolasRelevantes.filter(p => p.score === maxScore);

  const indiceAleatorio = Math.floor(Math.random() * topParabolas.length);
  const { score, ...parabola } = topParabolas[indiceAleatorio]; // Remove o score do retorno

  return parabola;
}

/**
 * Retorna todas as parábolas disponíveis
 * @returns {Array} Array com todas as parábolas
 */
export function getAllParabolas() {
  return [...parabolas];
}

/**
 * Retorna todos os temas disponíveis
 * @returns {Array} Array com todos os temas únicos
 */
export function getTemas() {
  return [...new Set(parabolas.map(p => p.tema))];
}

/**
 * Retorna estatísticas sobre as parábolas
 * @returns {Object} Objeto com estatísticas
 */
export function getEstatisticas() {
  const temas = getTemas();
  const estatisticas = {
    total: parabolas.length,
    porTema: {}
  };

  temas.forEach(tema => {
    estatisticas.porTema[tema] = parabolas.filter(p => p.tema === tema).length;
  });

  return estatisticas;
}

export default {
  getParabola,
  getParabolaForSituation,
  getAllParabolas,
  getTemas,
  getEstatisticas
};
