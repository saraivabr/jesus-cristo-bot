/**
 * Quiz Bíblico - Sistema de perguntas e respostas sobre a Bíblia
 * Funcionalidades: 50 perguntas (17 fácil, 17 médio, 16 difícil)
 * Categorias: AT, NT, Jesus, Parabolas, Profetas
 */

import {
  getQuizPerguntas,
  addQuizPergunta,
  saveQuizResultado,
  getQuizRanking,
  getQuizHistorico,
  getUsuario
} from '../database.js';

// Sessões ativas de quiz em memória
const sessoesQuiz = new Map();

// Pontuação por dificuldade
const PONTOS = {
  facil: 10,
  medio: 20,
  dificil: 30
};

// Perguntas do Quiz Bíblico
const perguntasBiblicas = [
  // ========== FÁCIL (17 perguntas) ==========
  // AT - Fácil
  {
    id: 1,
    pergunta: "Quem construiu a arca para salvar os animais do dilúvio?",
    opcoes: ["Abraão", "Moisés", "Noé", "Davi"],
    correta: 3,
    explicacao: "Noé foi escolhido por Deus para construir a arca e salvar sua família e os animais do grande dilúvio.",
    versiculo: "Gênesis 6:14",
    categoria: "AT",
    dificuldade: "facil"
  },
  {
    id: 2,
    pergunta: "Quantos dias Deus levou para criar o mundo?",
    opcoes: ["5 dias", "6 dias", "7 dias", "10 dias"],
    correta: 2,
    explicacao: "Deus criou o mundo em 6 dias e descansou no sétimo dia, abençoando-o e santificando-o.",
    versiculo: "Gênesis 2:2",
    categoria: "AT",
    dificuldade: "facil"
  },
  {
    id: 3,
    pergunta: "Qual foi o primeiro homem criado por Deus?",
    opcoes: ["Noé", "Adão", "Abraão", "Abel"],
    correta: 2,
    explicacao: "Adão foi o primeiro homem, criado por Deus do pó da terra no jardim do Éden.",
    versiculo: "Gênesis 2:7",
    categoria: "AT",
    dificuldade: "facil"
  },
  {
    id: 4,
    pergunta: "Quem matou o gigante Golias?",
    opcoes: ["Saul", "Davi", "Sansão", "Josué"],
    correta: 2,
    explicacao: "Davi, ainda jovem pastor, derrotou o gigante filisteu Golias com uma funda e uma pedra.",
    versiculo: "1 Samuel 17:50",
    categoria: "AT",
    dificuldade: "facil"
  },
  // NT - Fácil
  {
    id: 5,
    pergunta: "Em qual cidade Jesus nasceu?",
    opcoes: ["Nazaré", "Jerusalém", "Belém", "Cafarnaum"],
    correta: 3,
    explicacao: "Jesus nasceu em Belém da Judeia, cumprindo a profecia de Miqueias.",
    versiculo: "Mateus 2:1",
    categoria: "NT",
    dificuldade: "facil"
  },
  {
    id: 6,
    pergunta: "Quantos apóstolos Jesus escolheu?",
    opcoes: ["10", "11", "12", "13"],
    correta: 3,
    explicacao: "Jesus escolheu 12 apóstolos para serem seus discípulos mais próximos e continuarem sua obra.",
    versiculo: "Mateus 10:1-4",
    categoria: "NT",
    dificuldade: "facil"
  },
  {
    id: 7,
    pergunta: "Quem batizou Jesus no rio Jordão?",
    opcoes: ["Pedro", "João Batista", "Tiago", "André"],
    correta: 2,
    explicacao: "João Batista batizou Jesus no rio Jordão, quando o Espírito Santo desceu como pomba.",
    versiculo: "Mateus 3:13-16",
    categoria: "NT",
    dificuldade: "facil"
  },
  // Jesus - Fácil
  {
    id: 8,
    pergunta: "Qual foi o primeiro milagre de Jesus?",
    opcoes: ["Curar um cego", "Multiplicar pães", "Transformar água em vinho", "Ressuscitar Lázaro"],
    correta: 3,
    explicacao: "O primeiro milagre de Jesus foi nas bodas de Caná, onde transformou água em vinho.",
    versiculo: "João 2:11",
    categoria: "Jesus",
    dificuldade: "facil"
  },
  {
    id: 9,
    pergunta: "Quem era a mãe de Jesus?",
    opcoes: ["Maria Madalena", "Marta", "Maria", "Ana"],
    correta: 3,
    explicacao: "Maria foi a mãe terrena de Jesus, escolhida por Deus para dar à luz o Salvador.",
    versiculo: "Lucas 1:30-31",
    categoria: "Jesus",
    dificuldade: "facil"
  },
  {
    id: 10,
    pergunta: "Em quantos dias Jesus ressuscitou após sua morte?",
    opcoes: ["1 dia", "2 dias", "3 dias", "7 dias"],
    correta: 3,
    explicacao: "Jesus ressuscitou ao terceiro dia, conforme havia profetizado aos seus discípulos.",
    versiculo: "Mateus 16:21",
    categoria: "Jesus",
    dificuldade: "facil"
  },
  // Parábolas - Fácil
  {
    id: 11,
    pergunta: "Na parábola do filho pródigo, o que o filho mais novo pediu ao pai?",
    opcoes: ["Um emprego", "Sua herança", "Uma viagem", "Perdão"],
    correta: 2,
    explicacao: "O filho mais novo pediu sua parte da herança antes da morte do pai e foi para uma terra distante.",
    versiculo: "Lucas 15:12",
    categoria: "Parabolas",
    dificuldade: "facil"
  },
  {
    id: 12,
    pergunta: "Na parábola do semeador, onde a semente produziu fruto?",
    opcoes: ["No caminho", "Entre espinhos", "Em terra boa", "Nas pedras"],
    correta: 3,
    explicacao: "Apenas a semente que caiu em terra boa produziu fruto, representando quem ouve e pratica a Palavra.",
    versiculo: "Mateus 13:23",
    categoria: "Parabolas",
    dificuldade: "facil"
  },
  // Profetas - Fácil
  {
    id: 13,
    pergunta: "Qual profeta foi engolido por um grande peixe?",
    opcoes: ["Elias", "Eliseu", "Jonas", "Daniel"],
    correta: 3,
    explicacao: "Jonas foi engolido por um grande peixe quando fugiu da missão que Deus lhe deu em Nínive.",
    versiculo: "Jonas 1:17",
    categoria: "Profetas",
    dificuldade: "facil"
  },
  {
    id: 14,
    pergunta: "Qual profeta foi levado ao céu em um carro de fogo?",
    opcoes: ["Moisés", "Elias", "Enoque", "Isaías"],
    correta: 2,
    explicacao: "Elias foi levado ao céu em um redemoinho, com carros e cavalos de fogo.",
    versiculo: "2 Reis 2:11",
    categoria: "Profetas",
    dificuldade: "facil"
  },
  {
    id: 15,
    pergunta: "Quem libertou o povo de Israel do Egito?",
    opcoes: ["Abraão", "José", "Moisés", "Josué"],
    correta: 3,
    explicacao: "Moisés foi escolhido por Deus para libertar o povo de Israel da escravidão no Egito.",
    versiculo: "Êxodo 3:10",
    categoria: "Profetas",
    dificuldade: "facil"
  },
  {
    id: 16,
    pergunta: "Qual foi a praga final do Egito?",
    opcoes: ["Gafanhotos", "Trevas", "Morte dos primogênitos", "Sangue"],
    correta: 3,
    explicacao: "A décima e última praga foi a morte dos primogênitos do Egito, levando Faraó a libertar Israel.",
    versiculo: "Êxodo 12:29",
    categoria: "AT",
    dificuldade: "facil"
  },
  {
    id: 17,
    pergunta: "Quem traiu Jesus com um beijo?",
    opcoes: ["Pedro", "Tomé", "Judas Iscariotes", "Tiago"],
    correta: 3,
    explicacao: "Judas Iscariotes traiu Jesus com um beijo no Getsêmani, entregando-o aos soldados.",
    versiculo: "Mateus 26:48-49",
    categoria: "NT",
    dificuldade: "facil"
  },

  // ========== MÉDIO (17 perguntas) ==========
  // AT - Médio
  {
    id: 18,
    pergunta: "Por quantos anos o povo de Israel vagou no deserto?",
    opcoes: ["20 anos", "30 anos", "40 anos", "50 anos"],
    correta: 3,
    explicacao: "Israel vagou 40 anos no deserto por causa da incredulidade ao recusar entrar na Terra Prometida.",
    versiculo: "Números 14:33-34",
    categoria: "AT",
    dificuldade: "medio"
  },
  {
    id: 19,
    pergunta: "Qual era a profissão de Amós antes de ser profeta?",
    opcoes: ["Pescador", "Pastor e cultivador de sicômoros", "Carpinteiro", "Sacerdote"],
    correta: 2,
    explicacao: "Amós era pastor de ovelhas e cultivador de sicômoros antes de Deus chamá-lo para profetizar.",
    versiculo: "Amós 7:14",
    categoria: "Profetas",
    dificuldade: "medio"
  },
  {
    id: 20,
    pergunta: "Quantos livros compõem o Pentateuco?",
    opcoes: ["3", "4", "5", "6"],
    correta: 3,
    explicacao: "O Pentateuco são os 5 primeiros livros da Bíblia: Gênesis, Êxodo, Levítico, Números e Deuteronômio.",
    versiculo: "Tradição Bíblica",
    categoria: "AT",
    dificuldade: "medio"
  },
  {
    id: 21,
    pergunta: "Quem interpretou os sonhos do Faraó sobre as vacas gordas e magras?",
    opcoes: ["Daniel", "José", "Moisés", "Jacó"],
    correta: 2,
    explicacao: "José interpretou os sonhos do Faraó, prevendo 7 anos de fartura seguidos de 7 anos de fome.",
    versiculo: "Gênesis 41:25-32",
    categoria: "AT",
    dificuldade: "medio"
  },
  // NT - Médio
  {
    id: 22,
    pergunta: "Qual apóstolo era cobrador de impostos antes de seguir Jesus?",
    opcoes: ["Pedro", "Mateus", "João", "Tiago"],
    correta: 2,
    explicacao: "Mateus (também chamado Levi) era cobrador de impostos em Cafarnaum quando Jesus o chamou.",
    versiculo: "Mateus 9:9",
    categoria: "NT",
    dificuldade: "medio"
  },
  {
    id: 23,
    pergunta: "Quem escreveu o livro de Apocalipse?",
    opcoes: ["Paulo", "Pedro", "João", "Tiago"],
    correta: 3,
    explicacao: "O apóstolo João escreveu Apocalipse enquanto estava exilado na ilha de Patmos.",
    versiculo: "Apocalipse 1:1,9",
    categoria: "NT",
    dificuldade: "medio"
  },
  {
    id: 24,
    pergunta: "Quantas cartas Paulo escreveu que estão no Novo Testamento?",
    opcoes: ["10", "13", "15", "21"],
    correta: 2,
    explicacao: "Paulo escreveu 13 cartas que compõem parte significativa do Novo Testamento.",
    versiculo: "Cânon do NT",
    categoria: "NT",
    dificuldade: "medio"
  },
  {
    id: 25,
    pergunta: "Qual era o nome de Paulo antes de sua conversão?",
    opcoes: ["Simão", "Saulo", "Silas", "Barnabé"],
    correta: 2,
    explicacao: "Antes de se converter no caminho de Damasco, Paulo era chamado Saulo e perseguia cristãos.",
    versiculo: "Atos 9:1-4",
    categoria: "NT",
    dificuldade: "medio"
  },
  // Jesus - Médio
  {
    id: 26,
    pergunta: "Quantas pessoas Jesus alimentou na multiplicação dos pães e peixes?",
    opcoes: ["3.000 homens", "4.000 homens", "5.000 homens", "7.000 homens"],
    correta: 3,
    explicacao: "Jesus alimentou cerca de 5.000 homens, além de mulheres e crianças, com 5 pães e 2 peixes.",
    versiculo: "Mateus 14:21",
    categoria: "Jesus",
    dificuldade: "medio"
  },
  {
    id: 27,
    pergunta: "Por quantos dias Jesus foi tentado no deserto?",
    opcoes: ["7 dias", "21 dias", "40 dias", "50 dias"],
    correta: 3,
    explicacao: "Jesus jejuou e foi tentado pelo diabo durante 40 dias e 40 noites no deserto.",
    versiculo: "Mateus 4:1-2",
    categoria: "Jesus",
    dificuldade: "medio"
  },
  {
    id: 28,
    pergunta: "Qual discípulo caminhou sobre as águas com Jesus?",
    opcoes: ["João", "Tiago", "Pedro", "André"],
    correta: 3,
    explicacao: "Pedro caminhou sobre as águas em direção a Jesus, mas começou a afundar quando duvidou.",
    versiculo: "Mateus 14:28-31",
    categoria: "Jesus",
    dificuldade: "medio"
  },
  // Parábolas - Médio
  {
    id: 29,
    pergunta: "Na parábola do bom samaritano, quem passou primeiro pelo homem ferido?",
    opcoes: ["Um levita", "Um sacerdote", "Um samaritano", "Um fariseu"],
    correta: 2,
    explicacao: "Um sacerdote passou primeiro pelo outro lado, seguido por um levita, antes do samaritano ajudar.",
    versiculo: "Lucas 10:31",
    categoria: "Parabolas",
    dificuldade: "medio"
  },
  {
    id: 30,
    pergunta: "Na parábola dos talentos, quantos talentos o primeiro servo recebeu?",
    opcoes: ["1 talento", "2 talentos", "5 talentos", "10 talentos"],
    correta: 3,
    explicacao: "O primeiro servo recebeu 5 talentos, o segundo 2, e o terceiro 1, cada um conforme sua capacidade.",
    versiculo: "Mateus 25:15",
    categoria: "Parabolas",
    dificuldade: "medio"
  },
  {
    id: 31,
    pergunta: "Na parábola das dez virgens, quantas eram prudentes?",
    opcoes: ["3", "4", "5", "7"],
    correta: 3,
    explicacao: "Cinco virgens eram prudentes e levaram azeite extra, enquanto cinco eram imprudentes.",
    versiculo: "Mateus 25:2",
    categoria: "Parabolas",
    dificuldade: "medio"
  },
  // Profetas - Médio
  {
    id: 32,
    pergunta: "Qual profeta teve uma visão do vale de ossos secos?",
    opcoes: ["Isaías", "Jeremias", "Ezequiel", "Daniel"],
    correta: 3,
    explicacao: "Ezequiel teve a visão do vale de ossos secos que voltaram à vida, simbolizando a restauração de Israel.",
    versiculo: "Ezequiel 37:1-10",
    categoria: "Profetas",
    dificuldade: "medio"
  },
  {
    id: 33,
    pergunta: "Quem foi lançado na cova dos leões?",
    opcoes: ["Elias", "Eliseu", "Daniel", "Jonas"],
    correta: 3,
    explicacao: "Daniel foi lançado na cova dos leões por orar a Deus, mas foi miraculosamente protegido.",
    versiculo: "Daniel 6:16",
    categoria: "Profetas",
    dificuldade: "medio"
  },
  {
    id: 34,
    pergunta: "Qual profeta profetizou que o Messias nasceria em Belém?",
    opcoes: ["Isaías", "Miqueias", "Jeremias", "Malaquias"],
    correta: 2,
    explicacao: "Miqueias profetizou que de Belém Efrata sairia aquele que seria governador em Israel.",
    versiculo: "Miqueias 5:2",
    categoria: "Profetas",
    dificuldade: "medio"
  },

  // ========== DIFÍCIL (16 perguntas) ==========
  // AT - Difícil
  {
    id: 35,
    pergunta: "Qual era o nome da esposa de Moisés?",
    opcoes: ["Rebeca", "Raquel", "Zípora", "Lia"],
    correta: 3,
    explicacao: "Zípora, filha de Jetro, sacerdote de Midiã, foi a esposa de Moisés.",
    versiculo: "Êxodo 2:21",
    categoria: "AT",
    dificuldade: "dificil"
  },
  {
    id: 36,
    pergunta: "Quantos anos Matusalém viveu segundo a Bíblia?",
    opcoes: ["850 anos", "912 anos", "930 anos", "969 anos"],
    correta: 4,
    explicacao: "Matusalém viveu 969 anos, sendo a pessoa mais longeva mencionada na Bíblia.",
    versiculo: "Gênesis 5:27",
    categoria: "AT",
    dificuldade: "dificil"
  },
  {
    id: 37,
    pergunta: "Quem era o rei de Salém que abençoou Abraão?",
    opcoes: ["Abimelec", "Melquisedeque", "Faraó", "Hamurabi"],
    correta: 2,
    explicacao: "Melquisedeque, rei de Salém e sacerdote do Deus Altíssimo, abençoou Abraão.",
    versiculo: "Gênesis 14:18-20",
    categoria: "AT",
    dificuldade: "dificil"
  },
  {
    id: 38,
    pergunta: "Qual era o nome do monte onde Moisés recebeu os Dez Mandamentos?",
    opcoes: ["Monte Carmelo", "Monte das Oliveiras", "Monte Sinai", "Monte Moriá"],
    correta: 3,
    explicacao: "Moisés recebeu os Dez Mandamentos no Monte Sinai, também chamado Monte Horebe.",
    versiculo: "Êxodo 19:20",
    categoria: "AT",
    dificuldade: "dificil"
  },
  // NT - Difícil
  {
    id: 39,
    pergunta: "Qual era o nome do sumo sacerdote que julgou Jesus?",
    opcoes: ["Anás", "Caifás", "Aarão", "Zacarias"],
    correta: 2,
    explicacao: "Caifás era o sumo sacerdote que presidiu o julgamento de Jesus perante o Sinédrio.",
    versiculo: "Mateus 26:57",
    categoria: "NT",
    dificuldade: "dificil"
  },
  {
    id: 40,
    pergunta: "Quem substituiu Judas Iscariotes como apóstolo?",
    opcoes: ["Paulo", "Matias", "Barnabé", "Silas"],
    correta: 2,
    explicacao: "Matias foi escolhido por sorteio para substituir Judas entre os doze apóstolos.",
    versiculo: "Atos 1:26",
    categoria: "NT",
    dificuldade: "dificil"
  },
  {
    id: 41,
    pergunta: "Em qual cidade Paulo ficou cego por três dias após sua conversão?",
    opcoes: ["Jerusalém", "Antioquia", "Damasco", "Tarso"],
    correta: 3,
    explicacao: "Paulo (Saulo) ficou cego em Damasco e foi curado por Ananias após três dias.",
    versiculo: "Atos 9:8-9",
    categoria: "NT",
    dificuldade: "dificil"
  },
  // Jesus - Difícil
  {
    id: 42,
    pergunta: "Qual era o nome do jardim onde Jesus orou antes de ser preso?",
    opcoes: ["Éden", "Getsêmani", "Gólgota", "Cedrom"],
    correta: 2,
    explicacao: "Jesus orou intensamente no Getsêmani antes de ser traído e preso.",
    versiculo: "Mateus 26:36",
    categoria: "Jesus",
    dificuldade: "dificil"
  },
  {
    id: 43,
    pergunta: "Qual discípulo Jesus encontrou debaixo da figueira antes de chamá-lo?",
    opcoes: ["Filipe", "Bartolomeu", "Natanael", "Tomé"],
    correta: 3,
    explicacao: "Jesus viu Natanael debaixo da figueira antes de Filipe chamá-lo, demonstrando onisciência.",
    versiculo: "João 1:48",
    categoria: "Jesus",
    dificuldade: "dificil"
  },
  {
    id: 44,
    pergunta: "Quem ungiu os pés de Jesus com perfume caríssimo?",
    opcoes: ["Marta", "Maria de Betânia", "Maria Madalena", "Salomé"],
    correta: 2,
    explicacao: "Maria de Betânia ungiu os pés de Jesus com nardo puro, muito precioso.",
    versiculo: "João 12:3",
    categoria: "Jesus",
    dificuldade: "dificil"
  },
  // Parábolas - Difícil
  {
    id: 45,
    pergunta: "Na parábola do rico e Lázaro, para onde foi o rico após a morte?",
    opcoes: ["Paraíso", "Hades", "Sheol", "Geena"],
    correta: 2,
    explicacao: "O rico foi para o Hades, lugar de tormento, enquanto Lázaro foi levado ao seio de Abraão.",
    versiculo: "Lucas 16:23",
    categoria: "Parabolas",
    dificuldade: "dificil"
  },
  {
    id: 46,
    pergunta: "Na parábola do credor incompassivo, quanto o servo devia ao rei?",
    opcoes: ["100 denários", "1.000 talentos", "10.000 talentos", "10.000 denários"],
    correta: 3,
    explicacao: "O servo devia 10.000 talentos, uma dívida impagável que representa nossos pecados perante Deus.",
    versiculo: "Mateus 18:24",
    categoria: "Parabolas",
    dificuldade: "dificil"
  },
  // Profetas - Difícil
  {
    id: 47,
    pergunta: "Qual profeta foi chamado por Deus antes de nascer?",
    opcoes: ["Isaías", "Jeremias", "Ezequiel", "Amós"],
    correta: 2,
    explicacao: "Deus disse a Jeremias: 'Antes que te formasses no ventre te conheci, e te consagrei'.",
    versiculo: "Jeremias 1:5",
    categoria: "Profetas",
    dificuldade: "dificil"
  },
  {
    id: 48,
    pergunta: "Quem foi o profeta que casou com uma mulher infiel por ordem de Deus?",
    opcoes: ["Oséias", "Joel", "Amós", "Obadias"],
    correta: 1,
    explicacao: "Oséias casou-se com Gômer como símbolo da infidelidade de Israel para com Deus.",
    versiculo: "Oséias 1:2",
    categoria: "Profetas",
    dificuldade: "dificil"
  },
  {
    id: 49,
    pergunta: "Qual rei babilônico teve sonho com uma estátua de vários metais?",
    opcoes: ["Ciro", "Dario", "Nabucodonosor", "Belsazar"],
    correta: 3,
    explicacao: "Nabucodonosor sonhou com uma estátua representando reinos sucessivos, interpretada por Daniel.",
    versiculo: "Daniel 2:31-35",
    categoria: "AT",
    dificuldade: "dificil"
  },
  {
    id: 50,
    pergunta: "Qual era o nome do anjo que anunciou o nascimento de Jesus a Maria?",
    opcoes: ["Miguel", "Gabriel", "Rafael", "Uriel"],
    correta: 2,
    explicacao: "O anjo Gabriel foi enviado por Deus para anunciar a Maria que ela conceberia o Salvador.",
    versiculo: "Lucas 1:26-31",
    categoria: "NT",
    dificuldade: "dificil"
  }
];

/**
 * Embaralha um array usando o algoritmo Fisher-Yates
 */
function embaralhar(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Seleciona perguntas aleatórias para o quiz
 * @param {number} quantidade - Número de perguntas (padrão: 10)
 * @param {string|null} categoria - Filtrar por categoria específica
 * @param {string|null} dificuldade - Filtrar por dificuldade específica
 */
function selecionarPerguntas(quantidade = 10, categoria = null, dificuldade = null) {
  let perguntas = [...perguntasBiblicas];

  if (categoria) {
    perguntas = perguntas.filter(p => p.categoria.toLowerCase() === categoria.toLowerCase());
  }

  if (dificuldade) {
    perguntas = perguntas.filter(p => p.dificuldade === dificuldade);
  }

  return embaralhar(perguntas).slice(0, quantidade);
}

/**
 * Formata uma pergunta para envio no WhatsApp
 */
function formatarPergunta(pergunta, numeroAtual, totalPerguntas) {
  const emojisNumeros = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
  const emojisDificuldade = {
    facil: '🟢',
    medio: '🟡',
    dificil: '🔴'
  };

  let texto = `📖 *QUIZ BÍBLICO* 📖\n`;
  texto += `━━━━━━━━━━━━━━━━━━\n`;
  texto += `❓ *Pergunta ${numeroAtual}/${totalPerguntas}*\n`;
  texto += `${emojisDificuldade[pergunta.dificuldade]} Dificuldade: ${pergunta.dificuldade.charAt(0).toUpperCase() + pergunta.dificuldade.slice(1)}\n`;
  texto += `📚 Categoria: ${pergunta.categoria}\n`;
  texto += `━━━━━━━━━━━━━━━━━━\n\n`;
  texto += `*${pergunta.pergunta}*\n\n`;

  pergunta.opcoes.forEach((opcao, index) => {
    texto += `${emojisNumeros[index]} ${opcao}\n`;
  });

  texto += `\n_Responda com o número da opção (1-4)_`;

  return texto;
}

/**
 * Formata o resultado de uma resposta
 */
function formatarResultado(pergunta, respostaUsuario, acertou, pontosGanhos, pontuacaoTotal) {
  const emojisNumeros = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

  let texto = acertou
    ? `✅ *CORRETO!* +${pontosGanhos} pontos\n\n`
    : `❌ *INCORRETO!*\n\n`;

  if (!acertou) {
    texto += `Você respondeu: ${emojisNumeros[respostaUsuario - 1]} ${pergunta.opcoes[respostaUsuario - 1]}\n`;
    texto += `Resposta correta: ${emojisNumeros[pergunta.correta - 1]} ${pergunta.opcoes[pergunta.correta - 1]}\n\n`;
  }

  texto += `📜 *Explicação:*\n${pergunta.explicacao}\n\n`;
  texto += `📖 *Versículo:* ${pergunta.versiculo}\n\n`;
  texto += `🏆 *Pontuação atual:* ${pontuacaoTotal} pontos`;

  return texto;
}

/**
 * Formata o resultado final do quiz
 */
function formatarResultadoFinal(sessao) {
  const porcentagem = Math.round((sessao.acertos / sessao.totalPerguntas) * 100);
  let medalha = '';
  let mensagem = '';

  if (porcentagem === 100) {
    medalha = '🏆👑';
    mensagem = 'PERFEITO! Você é um verdadeiro conhecedor da Palavra!';
  } else if (porcentagem >= 80) {
    medalha = '🥇';
    mensagem = 'Excelente! Seu conhecimento bíblico é admirável!';
  } else if (porcentagem >= 60) {
    medalha = '🥈';
    mensagem = 'Muito bom! Continue estudando a Palavra!';
  } else if (porcentagem >= 40) {
    medalha = '🥉';
    mensagem = 'Bom esforço! A Bíblia tem muito a nos ensinar!';
  } else {
    medalha = '📖';
    mensagem = 'Continue lendo a Bíblia! Cada dia é uma oportunidade de aprender!';
  }

  let texto = `\n📊 *RESULTADO FINAL* 📊\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  texto += `${medalha} ${mensagem}\n\n`;
  texto += `✅ Acertos: ${sessao.acertos}/${sessao.totalPerguntas}\n`;
  texto += `📈 Porcentagem: ${porcentagem}%\n`;
  texto += `🏆 Pontuação total: ${sessao.pontuacao} pontos\n\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━━\n`;
  texto += `📖 "Lâmpada para os meus pés é a tua palavra,\ne luz para o meu caminho."\n`;
  texto += `— Salmos 119:105\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  texto += `_Digite *quiz* para jogar novamente!_`;

  return texto;
}

/**
 * Inicia um novo quiz para o usuário
 * @param {string} oderId - ID do usuário/conversa
 * @param {object} opcoes - Opções do quiz (categoria, dificuldade)
 */
async function iniciarQuiz(oderId, opcoes = {}) {
  // Verifica se já existe uma sessão ativa
  if (sessoesQuiz.has(oderId)) {
    return {
      sucesso: false,
      mensagem: `⚠️ Você já está em um quiz!\n\nResponda a pergunta atual ou digite *sair quiz* para encerrar.`
    };
  }

  const { categoria = null, dificuldade = null, quantidade = 10 } = opcoes;
  const perguntas = selecionarPerguntas(quantidade, categoria, dificuldade);

  if (perguntas.length === 0) {
    return {
      sucesso: false,
      mensagem: `❌ Não foram encontradas perguntas com os filtros selecionados.`
    };
  }

  // Cria a sessão do quiz
  const sessao = {
    oderId,
    perguntas,
    perguntaAtual: 0,
    pontuacao: 0,
    acertos: 0,
    totalPerguntas: perguntas.length,
    iniciadoEm: new Date(),
    respostas: []
  };

  sessoesQuiz.set(oderId, sessao);

  // Mensagem de boas-vindas
  let mensagemInicio = `🙏 *BEM-VINDO AO QUIZ BÍBLICO!* 🙏\n`;
  mensagemInicio += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  mensagemInicio += `📝 *Regras:*\n`;
  mensagemInicio += `• ${perguntas.length} perguntas sobre a Bíblia\n`;
  mensagemInicio += `• Responda com o número (1-4)\n`;
  mensagemInicio += `• 🟢 Fácil: 10 pontos\n`;
  mensagemInicio += `• 🟡 Médio: 20 pontos\n`;
  mensagemInicio += `• 🔴 Difícil: 30 pontos\n\n`;
  mensagemInicio += `_Digite *sair quiz* para encerrar a qualquer momento_\n`;
  mensagemInicio += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Primeira pergunta
  const primeiraPergunta = formatarPergunta(
    perguntas[0],
    1,
    perguntas.length
  );

  return {
    sucesso: true,
    mensagem: mensagemInicio + primeiraPergunta
  };
}

/**
 * Processa a resposta do usuário
 * @param {string} oderId - ID do usuário/conversa
 * @param {string} resposta - Resposta do usuário (1-4)
 */
async function processarResposta(oderId, resposta) {
  const sessao = sessoesQuiz.get(oderId);

  if (!sessao) {
    return {
      sucesso: false,
      mensagem: null,
      emQuiz: false
    };
  }

  // Verifica se a resposta é válida
  const respostaNum = parseInt(resposta);
  if (isNaN(respostaNum) || respostaNum < 1 || respostaNum > 4) {
    return {
      sucesso: false,
      mensagem: `⚠️ Resposta inválida!\n\nDigite um número de *1* a *4* para responder.\n\n_Ou digite *sair quiz* para encerrar._`,
      emQuiz: true
    };
  }

  const perguntaAtual = sessao.perguntas[sessao.perguntaAtual];
  const acertou = respostaNum === perguntaAtual.correta;
  const pontosGanhos = acertou ? PONTOS[perguntaAtual.dificuldade] : 0;

  // Atualiza a sessão
  if (acertou) {
    sessao.pontuacao += pontosGanhos;
    sessao.acertos++;
  }

  sessao.respostas.push({
    perguntaId: perguntaAtual.id,
    resposta: respostaNum,
    correta: perguntaAtual.correta,
    acertou,
    pontos: pontosGanhos
  });

  // Formata resultado da resposta atual
  let mensagem = formatarResultado(
    perguntaAtual,
    respostaNum,
    acertou,
    pontosGanhos,
    sessao.pontuacao
  );

  // Avança para próxima pergunta ou finaliza
  sessao.perguntaAtual++;

  if (sessao.perguntaAtual >= sessao.totalPerguntas) {
    // Quiz finalizado
    mensagem += formatarResultadoFinal(sessao);

    // Salva resultado no banco de dados
    try {
      await saveQuizResultado({
        oderId,
        pontuacao: sessao.pontuacao,
        acertos: sessao.acertos,
        total: sessao.totalPerguntas,
        respostas: sessao.respostas,
        iniciadoEm: sessao.iniciadoEm,
        finalizadoEm: new Date()
      });
    } catch (error) {
      console.error('Erro ao salvar resultado do quiz:', error);
    }

    // Remove a sessão
    sessoesQuiz.delete(oderId);

    return {
      sucesso: true,
      mensagem,
      emQuiz: false,
      finalizado: true,
      resultado: {
        pontuacao: sessao.pontuacao,
        acertos: sessao.acertos,
        total: sessao.totalPerguntas
      }
    };
  }

  // Próxima pergunta
  const proximaPergunta = formatarPergunta(
    sessao.perguntas[sessao.perguntaAtual],
    sessao.perguntaAtual + 1,
    sessao.totalPerguntas
  );

  mensagem += `\n\n${'─'.repeat(30)}\n\n` + proximaPergunta;

  return {
    sucesso: true,
    mensagem,
    emQuiz: true
  };
}

/**
 * Verifica se o usuário está em um quiz ativo
 * @param {string} oderId - ID do usuário/conversa
 */
function isEmQuiz(oderId) {
  return sessoesQuiz.has(oderId);
}

/**
 * Finaliza o quiz do usuário prematuramente
 * @param {string} oderId - ID do usuário/conversa
 */
async function finalizarQuiz(oderId) {
  const sessao = sessoesQuiz.get(oderId);

  if (!sessao) {
    return {
      sucesso: false,
      mensagem: `⚠️ Você não está em nenhum quiz no momento.`
    };
  }

  const perguntasRespondidas = sessao.perguntaAtual;

  let mensagem = `🛑 *QUIZ ENCERRADO* 🛑\n`;
  mensagem += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  mensagem += `📊 *Seu progresso:*\n`;
  mensagem += `• Perguntas respondidas: ${perguntasRespondidas}/${sessao.totalPerguntas}\n`;
  mensagem += `• Acertos: ${sessao.acertos}\n`;
  mensagem += `• Pontuação: ${sessao.pontuacao} pontos\n\n`;
  mensagem += `_Digite *quiz* para iniciar um novo quiz!_`;

  // Salva resultado parcial se houver perguntas respondidas
  if (perguntasRespondidas > 0) {
    try {
      await saveQuizResultado({
        oderId,
        pontuacao: sessao.pontuacao,
        acertos: sessao.acertos,
        total: perguntasRespondidas,
        respostas: sessao.respostas,
        iniciadoEm: sessao.iniciadoEm,
        finalizadoEm: new Date(),
        encerradoPrematuramente: true
      });
    } catch (error) {
      console.error('Erro ao salvar resultado parcial do quiz:', error);
    }
  }

  // Remove a sessão
  sessoesQuiz.delete(oderId);

  return {
    sucesso: true,
    mensagem
  };
}

/**
 * Obtém o ranking do quiz
 * @param {number} limite - Quantidade de posições no ranking
 */
async function obterRanking(limite = 10) {
  try {
    const ranking = await getQuizRanking(limite);

    if (!ranking || ranking.length === 0) {
      return {
        sucesso: true,
        mensagem: `🏆 *RANKING DO QUIZ* 🏆\n\n_Ainda não há resultados no ranking._\n\nSeja o primeiro a jogar! Digite *quiz* para começar.`
      };
    }

    let mensagem = `🏆 *RANKING DO QUIZ BÍBLICO* 🏆\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const medalhas = ['🥇', '🥈', '🥉'];

    ranking.forEach((item, index) => {
      const medalha = medalhas[index] || `${index + 1}º`;
      mensagem += `${medalha} *${item.nome || 'Anônimo'}*\n`;
      mensagem += `   📊 ${item.pontuacao} pts | ✅ ${item.acertos} acertos\n\n`;
    });

    mensagem += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    mensagem += `_Digite *quiz* para jogar!_`;

    return {
      sucesso: true,
      mensagem
    };
  } catch (error) {
    console.error('Erro ao obter ranking:', error);
    return {
      sucesso: false,
      mensagem: `❌ Erro ao carregar o ranking. Tente novamente mais tarde.`
    };
  }
}

/**
 * Obtém o histórico de quiz do usuário
 * @param {string} oderId - ID do usuário
 */
async function obterHistorico(oderId) {
  try {
    const historico = await getQuizHistorico(oderId);

    if (!historico || historico.length === 0) {
      return {
        sucesso: true,
        mensagem: `📜 *SEU HISTÓRICO* 📜\n\n_Você ainda não completou nenhum quiz._\n\nDigite *quiz* para começar!`
      };
    }

    let mensagem = `📜 *SEU HISTÓRICO NO QUIZ* 📜\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    historico.slice(0, 5).forEach((item, index) => {
      const data = new Date(item.finalizadoEm).toLocaleDateString('pt-BR');
      const porcentagem = Math.round((item.acertos / item.total) * 100);
      mensagem += `📅 *${data}*\n`;
      mensagem += `   🏆 ${item.pontuacao} pts | ✅ ${item.acertos}/${item.total} (${porcentagem}%)\n\n`;
    });

    mensagem += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    mensagem += `_Digite *quiz* para jogar novamente!_`;

    return {
      sucesso: true,
      mensagem
    };
  } catch (error) {
    console.error('Erro ao obter histórico:', error);
    return {
      sucesso: false,
      mensagem: `❌ Erro ao carregar o histórico. Tente novamente mais tarde.`
    };
  }
}

/**
 * Obtém estatísticas do quiz
 */
function obterEstatisticas() {
  const stats = {
    totalPerguntas: perguntasBiblicas.length,
    porDificuldade: {
      facil: perguntasBiblicas.filter(p => p.dificuldade === 'facil').length,
      medio: perguntasBiblicas.filter(p => p.dificuldade === 'medio').length,
      dificil: perguntasBiblicas.filter(p => p.dificuldade === 'dificil').length
    },
    porCategoria: {}
  };

  perguntasBiblicas.forEach(p => {
    if (!stats.porCategoria[p.categoria]) {
      stats.porCategoria[p.categoria] = 0;
    }
    stats.porCategoria[p.categoria]++;
  });

  return stats;
}

export {
  iniciarQuiz,
  processarResposta,
  isEmQuiz,
  finalizarQuiz,
  obterRanking,
  obterHistorico,
  obterEstatisticas,
  perguntasBiblicas, // Exporta para testes/administração
  PONTOS
};

export default {
  iniciarQuiz,
  processarResposta,
  isEmQuiz,
  finalizarQuiz,
  obterRanking,
  obterHistorico,
  obterEstatisticas
};
