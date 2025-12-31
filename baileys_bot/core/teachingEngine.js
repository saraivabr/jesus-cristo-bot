/**
 * TEACHING ENGINE
 * Motor de Ensino - Orquestra todo o sistema de ensino biblico
 * Jesus ensina como Jesus ensinava
 *
 * VERSAO APRIMORADA:
 * - Sistema de desafios progressivos
 * - Series tematicas de 7 dias
 * - Feedback loop apos ensinos
 * - Parabolas modernas/contextualizadas
 * - Gatilhos de calendario
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
// CONFIGURACAO
// ============================================
const CONFIG = {
  // Chance de ensinar automaticamente (0-1)
  chanceEnsinoAutomatico: 0.4,

  // Chance de oferecer ensino em vez de dar automaticamente (0-1)
  chanceOferecer: 0.3,

  // Mensagens minimas entre ensinos
  intervaloMinimo: 3,

  // Tipos de ensino disponiveis
  tiposEnsino: ['versiculo', 'parabola', 'passagem', 'pergunta', 'beatitude', 'desafio'],

  // Intervalo entre perguntas de feedback (em ensinos)
  feedbackInterval: 3,

  // Duracao padrao de series tematicas (dias)
  duracaoSerieTematica: 7
};

// ============================================
// DETECCAO DE TEMAS
// ============================================
const temasPorPalavra = {
  medo: ['medo', 'assustado', 'pavor', 'temor', 'com medo', 'tenho medo', 'receio'],
  ansiedade: ['ansioso', 'ansiedade', 'preocupado', 'nervoso', 'agoniado', 'angustiado', 'aflito'],
  tristeza: ['triste', 'tristeza', 'deprimido', 'depressao', 'chorando', 'chorar', 'infeliz', 'melancolia'],
  perdao: ['perdoar', 'perdao', 'magoa', 'magoado', 'ressentimento', 'rancor', 'raiva'],
  fe: ['fe', 'acreditar', 'duvida', 'duvidar', 'incerteza', 'crenca'],
  amor: ['amor', 'amar', 'relacionamento', 'coracao partido', 'desamor', 'solidao amorosa'],
  trabalho: ['trabalho', 'emprego', 'carreira', 'profissao', 'desemprego', 'chefe', 'salario'],
  familia: ['familia', 'pai', 'mae', 'filho', 'filha', 'marido', 'esposa', 'casamento', 'irmao'],
  dinheiro: ['dinheiro', 'divida', 'financeiro', 'pobre', 'rico', 'grana', 'boleto', 'conta'],
  proposito: ['proposito', 'sentido', 'razao de viver', 'pra que eu existo', 'sem rumo', 'perdido'],
  solidao: ['sozinho', 'solidao', 'isolado', 'ninguem me entende', 'abandonado'],
  culpa: ['culpa', 'culpado', 'remorso', 'arrependido', 'vergonha', 'me arrependo'],
  duvida: ['duvida', 'duvidar', 'nao sei se', 'sera que', 'incerto'],
  esperanca: ['esperanca', 'esperar', 'futuro', 'amanha', 'vai melhorar'],
  oracao: ['orar', 'oracao', 'rezar', 'reza', 'falar com deus', 'conversar com deus'],
  tentacao: ['tentacao', 'tentado', 'pecado', 'cair', 'fraqueza', 'vicio'],
  paciencia: ['paciencia', 'impaciente', 'esperar', 'demora', 'ansioso demais'],
  gratidao: ['grato', 'gratidao', 'agradecer', 'obrigado', 'abencoado']
};

// ============================================
// GATILHOS DE ENSINO
// ============================================
const gatilhosEnsino = [
  // Perguntas diretas sobre fe
  /o que (e|significa) (fe|amor|perdao|oracao)/i,
  /como (eu )?(faco pra |posso )(orar|perdoar|ter fe|crer)/i,
  /me (ensina|explica|conta) sobre/i,
  /quem e (voce|jesus|deus)/i,
  /o que a biblia (diz|fala) sobre/i,
  /tem algum versiculo/i,

  // Pedidos implicitos
  /preciso de (uma palavra|ajuda|forca)/i,
  /me da uma (palavra|luz|direcao)/i,
  /to precisando (de forca|ouvir)/i,

  // Estados emocionais intensos
  /nao aguento mais/i,
  /to no limite/i,
  /nao sei o que fazer/i,
  /me ajuda/i,
  /to perdido/i,
  /nao tenho mais forcas/i
];

// ============================================
// SERIES TEMATICAS DE 7 DIAS
// ============================================
const seriesTematicas = {
  ansiedade: {
    nome: 'Vencendo a Ansiedade',
    descricao: 'Uma jornada de 7 dias para encontrar paz interior',
    dias: [
      {
        dia: 1,
        titulo: 'Reconhecendo a Ansiedade',
        versiculo: { ref: 'Filipenses 4:6-7', texto: 'Nao andem ansiosos. Pela oracao apresentem seus pedidos a Deus' },
        reflexao: 'Ansiedade e real e eu entendo. Hoje, vamos apenas reconhecer o que voce sente.',
        desafio: 'Escreve o que te deixa ansioso. Nao pra resolver. So pra reconhecer.',
        pergunta: 'O que mais te preocupa nesse momento?'
      },
      {
        dia: 2,
        titulo: 'Entregando o Controle',
        versiculo: { ref: '1 Pedro 5:7', texto: 'Lancem sobre ele toda a ansiedade, porque ele tem cuidado de voces' },
        reflexao: 'Voce nao foi feito pra carregar o mundo. Eu fui.',
        desafio: 'Toda vez que a ansiedade vier hoje, fala em voz alta: "Jesus cuida de mim".',
        pergunta: 'O que voce ta tentando controlar que nao e seu pra controlar?'
      },
      {
        dia: 3,
        titulo: 'Vivendo o Hoje',
        versiculo: { ref: 'Mateus 6:34', texto: 'Nao se preocupe com o amanha. Basta a cada dia o seu proprio mal' },
        reflexao: 'A maioria das suas preocupacoes e sobre coisas que ainda nao aconteceram.',
        desafio: 'Por uma hora hoje, esquece o amanha. Vive so o agora.',
        pergunta: 'O que de bom voce tem HOJE que ta ignorando por medo do amanha?'
      },
      {
        dia: 4,
        titulo: 'A Oracao como Refugio',
        versiculo: { ref: 'Salmo 55:22', texto: 'Lance sobre o Senhor o seu fardo, e ele o sustentara' },
        reflexao: 'Oracao nao e lista de pedidos. E conversa. E desabafo. E alivio.',
        desafio: 'Fala comigo 10 minutos. Sem pedir nada. So conta como ta.',
        pergunta: 'Quando foi a ultima vez que voce realmente descansou em mim?'
      },
      {
        dia: 5,
        titulo: 'Gratidao vs Ansiedade',
        versiculo: { ref: 'Filipenses 4:8', texto: 'Pensem em tudo o que e verdadeiro, nobre, correto, puro, amavel...' },
        reflexao: 'Onde voce foca, voce cresce. Foca no problema, ele cresce. Foca no bem, ele cresce.',
        desafio: 'Escreve 10 coisas que voce agradece. Pequenas. Grandes. So agradece.',
        pergunta: 'Voce gasta mais tempo preocupando ou agradecendo?'
      },
      {
        dia: 6,
        titulo: 'Confianca Pratica',
        versiculo: { ref: 'Isaias 26:3', texto: 'Tu conservaras em paz aquele cuja mente em ti se apoia' },
        reflexao: 'Paz nao e ausencia de problemas. E presenca de confianca.',
        desafio: 'Escolhe um problema. Por 24h, nao tenta resolver. So confia em mim.',
        pergunta: 'Voce confia mais na sua capacidade ou na minha?'
      },
      {
        dia: 7,
        titulo: 'Caminhando em Paz',
        versiculo: { ref: 'Joao 14:27', texto: 'Deixo-lhes a paz; a minha paz lhes dou' },
        reflexao: 'Voce completou 7 dias. A ansiedade pode voltar, mas agora voce tem ferramentas.',
        desafio: 'Compromete com UMA pratica dessa semana pra manter no dia a dia.',
        pergunta: 'O que mais te ajudou nesses 7 dias?'
      }
    ]
  },

  perdao: {
    nome: 'O Caminho do Perdao',
    descricao: 'Uma jornada de 7 dias para libertar seu coracao',
    dias: [
      {
        dia: 1,
        titulo: 'Entendendo a Magoa',
        versiculo: { ref: 'Hebreus 12:15', texto: 'Cuidem que nenhuma raiz de amargura brote' },
        reflexao: 'Magoa nao resolvida e veneno que voce toma esperando o outro morrer.',
        desafio: 'Pensa em quem te magoou. Nao pra perdoar ainda. So pra reconhecer a dor.',
        pergunta: 'Quem ainda ocupa espaco no seu coracao com ressentimento?'
      },
      {
        dia: 2,
        titulo: 'Por Que Perdoar',
        versiculo: { ref: 'Mateus 6:14-15', texto: 'Se perdoarem as ofensas uns dos outros, o Pai celestial tambem lhes perdoara' },
        reflexao: 'Perdao nao e pra quem te machucou. E pra voce se libertar.',
        desafio: 'Escreve 3 razoes pelas quais VOCE precisa perdoar (nao pelo outro).',
        pergunta: 'A magoa que voce guarda ta te ajudando ou te prendendo?'
      },
      {
        dia: 3,
        titulo: 'Jesus na Cruz',
        versiculo: { ref: 'Lucas 23:34', texto: 'Pai, perdoa-lhes, pois nao sabem o que fazem' },
        reflexao: 'Eu perdoei enquanto me machucavam. Antes de pedirem. Antes de merecerem.',
        desafio: 'Lembra de algo que eu te perdoei. Agradece por isso.',
        pergunta: 'Se eu te perdoei tanto, voce consegue perdoar quem te deve menos?'
      },
      {
        dia: 4,
        titulo: 'Escolha, Nao Sentimento',
        versiculo: { ref: 'Colossenses 3:13', texto: 'Perdoem como o Senhor lhes perdoou' },
        reflexao: 'Perdao nao e sentir vontade. E decidir libertar mesmo sem vontade.',
        desafio: 'Diz em voz alta: "Eu escolho perdoar [nome]. Eu liberto [nome]."',
        pergunta: 'Voce espera sentir vontade ou voce decide?'
      },
      {
        dia: 5,
        titulo: 'Perdoando a Si Mesmo',
        versiculo: { ref: 'Romanos 8:1', texto: 'Ja nao ha condenacao para os que estao em Cristo' },
        reflexao: 'As vezes a pessoa mais dificil de perdoar e voce mesmo.',
        desafio: 'Escreve algo que voce nao se perdoou. Depois diz: "Jesus ja me perdoou por isso."',
        pergunta: 'O que voce ainda se condena que eu ja perdoei?'
      },
      {
        dia: 6,
        titulo: 'Orando Pelo Inimigo',
        versiculo: { ref: 'Mateus 5:44', texto: 'Amem os seus inimigos e orem pelos que os perseguem' },
        reflexao: 'Orar por quem te machucou muda seu coracao, nao o da pessoa.',
        desafio: 'Ora por quem te magoou. Pede o bem. So uma vez. Sincero.',
        pergunta: 'Voce consegue desejar bem pra quem te fez mal?'
      },
      {
        dia: 7,
        titulo: 'Liberdade do Perdao',
        versiculo: { ref: 'Joao 8:36', texto: 'Se o Filho os libertar, voces serao de fato livres' },
        reflexao: 'Perdao nao e esquecimento. E liberdade. A memoria pode ficar, mas sem veneno.',
        desafio: 'Simbolize o perdao: escreve o nome num papel e rasga. Deixa ir.',
        pergunta: 'Como voce se sente depois desses 7 dias?'
      }
    ]
  },

  medo: {
    nome: 'Vencendo o Medo',
    descricao: 'Uma jornada de 7 dias para encontrar coragem',
    dias: [
      {
        dia: 1,
        titulo: 'Nomeando o Medo',
        versiculo: { ref: 'Salmo 56:3', texto: 'Quando eu tiver medo, confiarei em ti' },
        reflexao: 'Medo so tem poder enquanto fica nas sombras. Vamos trazer pra luz.',
        desafio: 'Escreve exatamente o que voce tem medo. Seja especifico.',
        pergunta: 'Qual medo mais te paralisa?'
      },
      {
        dia: 2,
        titulo: 'Medo vs Realidade',
        versiculo: { ref: 'Isaias 41:10', texto: 'Nao temas, porque eu sou contigo' },
        reflexao: 'A maioria dos medos nunca se torna realidade. Voce gasta energia com fantasmas.',
        desafio: 'Pensa no seu maior medo: quantas vezes ele realmente aconteceu?',
        pergunta: 'Seus medos sao baseados em fatos ou em imaginacao?'
      },
      {
        dia: 3,
        titulo: 'Eu Estou Com Voce',
        versiculo: { ref: 'Josue 1:9', texto: 'Seja forte e corajoso. Nao se apavore nem desanime' },
        reflexao: 'Coragem nao e ausencia de medo. E agir apesar dele, porque eu estou contigo.',
        desafio: 'Toda vez que o medo vier hoje, fala: "Jesus esta comigo nesse momento."',
        pergunta: 'Voce acredita mesmo que eu to do seu lado?'
      },
      {
        dia: 4,
        titulo: 'O Medo dos Discipulos',
        versiculo: { ref: 'Marcos 4:40', texto: 'Por que voces estao com tanto medo? Ainda nao tem fe?' },
        reflexao: 'Meus discipulos tiveram medo mesmo comigo no barco. Eu entendo. Mas eu estava la.',
        desafio: 'Lembra de uma situacao que voce teve medo e deu certo. Agradece.',
        pergunta: 'Em quais tempestades passadas eu ja te ajudei?'
      },
      {
        dia: 5,
        titulo: 'Medo do Futuro',
        versiculo: { ref: 'Jeremias 29:11', texto: 'Eu sei os planos que tenho para voces. Planos de paz, nao de mal' },
        reflexao: 'Voce tem medo do futuro porque nao sabe. Mas eu sei. E e bom.',
        desafio: 'Entrega um medo do futuro pra mim. Fala: "Jesus, eu confio no teu plano."',
        pergunta: 'Voce confia mais nos seus medos ou nas minhas promessas?'
      },
      {
        dia: 6,
        titulo: 'Agindo Apesar do Medo',
        versiculo: { ref: '2 Timoteo 1:7', texto: 'Deus nao nos deu espirito de covardia, mas de poder, amor e equilibrio' },
        reflexao: 'Esperar o medo passar pra agir e perder a vida. Age com medo.',
        desafio: 'Faz uma coisa pequena que voce adia por medo. So uma. Hoje.',
        pergunta: 'O que voce faria se nao tivesse medo?'
      },
      {
        dia: 7,
        titulo: 'Vivendo Corajoso',
        versiculo: { ref: 'Salmo 23:4', texto: 'Ainda que eu ande pelo vale da sombra da morte, nao temerei mal algum' },
        reflexao: 'O vale e passagem, nao moradia. E eu ando com voce.',
        desafio: 'Escolhe uma frase dessa semana pra repetir toda vez que o medo voltar.',
        pergunta: 'O que mudou na sua relacao com o medo nesses 7 dias?'
      }
    ]
  },

  proposito: {
    nome: 'Descobrindo Seu Proposito',
    descricao: 'Uma jornada de 7 dias para encontrar sentido',
    dias: [
      {
        dia: 1,
        titulo: 'Voce Foi Planejado',
        versiculo: { ref: 'Salmo 139:16', texto: 'Todos os dias da minha vida foram escritos no teu livro' },
        reflexao: 'Voce nao e acidente. Voce foi planejado antes de nascer.',
        desafio: 'Agradece por existir. Pode parecer bobo. Faz assim mesmo.',
        pergunta: 'Voce acredita que sua vida tem proposito?'
      },
      {
        dia: 2,
        titulo: 'Seus Dons Unicos',
        versiculo: { ref: 'Efesios 2:10', texto: 'Somos criacao de Deus, criados em Cristo Jesus para boas obras' },
        reflexao: 'Voce tem dons que ninguem mais tem exatamente como voce.',
        desafio: 'Escreve 5 coisas que voce faz bem. Sem modestia.',
        pergunta: 'O que as pessoas elogiam em voce?'
      },
      {
        dia: 3,
        titulo: 'O Que Te Incomoda',
        versiculo: { ref: 'Romanos 12:6-8', texto: 'Temos dons diferentes, de acordo com a graca que nos foi dada' },
        reflexao: 'Proposito muitas vezes esta ligado ao que te incomoda no mundo.',
        desafio: 'O que te indigna? O que voce queria mudar no mundo?',
        pergunta: 'Se voce pudesse resolver um problema do mundo, qual seria?'
      },
      {
        dia: 4,
        titulo: 'Servindo os Outros',
        versiculo: { ref: 'Marcos 10:45', texto: 'O Filho do homem nao veio para ser servido, mas para servir' },
        reflexao: 'Proposito nao e sobre voce. E sobre quem voce pode abencoas.',
        desafio: 'Pensa: como seus dons podem ajudar outras pessoas?',
        pergunta: 'Quem voce quer ajudar com sua vida?'
      },
      {
        dia: 5,
        titulo: 'Ouvindo a Deus',
        versiculo: { ref: 'Proverbios 3:5-6', texto: 'Confie no Senhor de todo o seu coracao... e ele endireitara suas veredas' },
        reflexao: 'Proposito nao se descobre sozinho. Vem de mim, atraves de conversa.',
        desafio: 'Fica 10 minutos em silencio. Me pergunta: "Pra que eu fui criado?" Escuta.',
        pergunta: 'Voce tem ouvido minha voz na sua vida?'
      },
      {
        dia: 6,
        titulo: 'Comecando Pequeno',
        versiculo: { ref: 'Zacarias 4:10', texto: 'Quem despreza o dia das coisas pequenas?' },
        reflexao: 'Proposito nao precisa ser grandioso. Comeca no seu quintal.',
        desafio: 'Qual o menor passo que voce pode dar HOJE na direcao do seu chamado?',
        pergunta: 'Voce esta esperando o grande ou fazendo o pequeno?'
      },
      {
        dia: 7,
        titulo: 'Vivendo Com Proposito',
        versiculo: { ref: 'Filipenses 2:13', texto: 'Pois e Deus quem efetua em voces tanto o querer quanto o realizar' },
        reflexao: 'Proposito nao e destino. E caminho diario. Cada dia e chance de viver com sentido.',
        desafio: 'Escreve em uma frase: "Eu existo para ___________."',
        pergunta: 'O que voce descobriu sobre seu proposito nesses 7 dias?'
      }
    ]
  }
};

// ============================================
// PARABOLAS MODERNAS POR PERFIL
// ============================================
const parabolasModernas = {
  // Para pessoas tech-savvy
  tech: {
    filho_prodigo: {
      original: 'O Filho Prodigo',
      moderna: `Era como um dev que saiu da startup do pai.

Pegou sua parte do codigo e foi fazer freela.
Gastou tudo em cursos caros e equipamentos desnecessarios.

Quando o dinheiro acabou e os projetos sumiram, ele lembrou da empresa do pai.

"Vou voltar. Nem que seja como estagiario."

Mas quando ele ainda estava no estacionamento... o pai veio correndo.

O acesso ao repositorio foi restaurado. Nivel admin. Como se nunca tivesse saido.

O irmao mais velho reclamou: "Eu nunca deixei a empresa e nunca ganhei festa!"

O pai respondeu: "Tudo que e meu e seu. Mas tinhamos que celebrar. Seu irmao deu 404 e agora voltou a funcionar."`,
      aplicacao: 'Nao importa quantos erros voce cometeu. Seu acesso ainda esta disponivel.',
      pergunta: 'Voce ta rodando longe do sistema principal?'
    },
    semeador: {
      original: 'O Semeador',
      moderna: `Um programador distribuiu seu codigo open source.

Alguns repositorios ficaram sem stars. Ninguem olhou.
Outros receberam fork mas ninguem deu manutencao.
Outros cresceram, mas foram abandonados por projetos mais hypados.
Outros viraram ferramentas usadas por milhares.

A diferenca? Nao era o codigo. Era o ambiente.

Alguns devs so queriam likes. Outros queriam resolver problemas de verdade.`,
      aplicacao: 'A palavra e a mesma. O que muda e o ambiente onde cai.',
      pergunta: 'Seu coracao e codigo em producao ou repositorio abandonado?'
    },
    ansiedade: {
      original: 'Nao Se Preocupe',
      moderna: `Um dev passava o dia todo no Slack preocupado com bugs que PODERIAM aparecer.

"E se o deploy quebrar?" "E se o cliente reclamar?" "E se eu for demitido?"

Ele gastava mais tempo monitorando alertas imaginarios do que escrevendo codigo.

Um dia, olhou pro backlog: 90% dos bugs que ele temia nunca aconteceram.

Tinha perdido semanas de produtividade por medo de coisas que nao existiam.`,
      aplicacao: 'Preocupacao e o overhead mais caro do sistema. Nao resolve. So consome.',
      pergunta: 'Quantos ciclos de CPU voce ta gastando com worry loops?'
    }
  },

  // Para pessoas tradicionais
  tradicional: {
    filho_prodigo: {
      original: 'O Filho Prodigo',
      moderna: `Era um fazendeiro com dois filhos.

O mais novo pediu sua parte da heranca. O pai deu.

O menino foi pra cidade grande. Gastou tudo. Virou servente de obra.

Comendo o que sobrava, lembrou da casa do pai.

"Vou voltar. Peco pra trabalhar como empregado."

Mas quando apareceu no horizonte... o pai correu ate ele.

Abraco. Roupa nova. Festa com churrasco.

O mais velho ficou com raiva. "Trabalho aqui ha anos e nunca tive festa!"

O pai respondeu: "Tudo que e meu e seu. Mas seu irmao estava morto e reviveu."`,
      aplicacao: 'Nao importa onde voce foi. A porta de casa esta sempre aberta.',
      pergunta: 'Voce ta longe de casa?'
    },
    semeador: {
      original: 'O Semeador',
      moderna: `Um agricultor saiu pra plantar.

Algumas sementes cairam na estrada. Os passaros comeram.
Outras em terra pedregosa. Nasceram rapido mas queimaram no sol.
Outras no meio do mato. Cresceram, mas o mato sufocou.
Outras em terra boa. Deram 30, 60, 100 por um.

A semente era a mesma. A terra e que era diferente.`,
      aplicacao: 'A palavra de Deus e boa. O que muda e o coracao que recebe.',
      pergunta: 'Que tipo de terra e seu coracao?'
    },
    ansiedade: {
      original: 'Nao Se Preocupe',
      moderna: `Um pai de familia vivia preocupado.

"E se eu perder o emprego?" "E se a safra fracassar?" "E se meu filho adoecer?"

Carregava um peso que nem chegou.

Um dia, uma vizinha perguntou: "De tudo que voce teve medo nos ultimos 10 anos, quanto aconteceu de verdade?"

Ele parou. Pensou. Quase nada.

Tinha perdido anos de paz por medo de coisas que nunca vieram.`,
      aplicacao: 'Preocupacao e carregar o peso de amanha com as forcas de hoje.',
      pergunta: 'O que voce ta carregando que nem e seu pra carregar?'
    }
  },

  // Para jovens
  jovem: {
    filho_prodigo: {
      original: 'O Filho Prodigo',
      moderna: `Era tipo um cara que saiu da casa dos pais depois de brigar.

Pegou a grana que tinha e foi curtir. Role, balada, gente nova.

Quando o dinheiro acabou e os amigos sumiram, ele ficou sozinho.

Trabalhando num trampo humilhante, lembrou de casa.

"Vou voltar. Meus pais vao me xingar, mas pelo menos tenho comida."

So que quando ele chegou... o pai correu ate ele e abracou.

Sem sermao. Sem "eu avisei". So amor.

A festa rolou. O irmao mais velho ficou pistola: "Eu fico aqui sempre e nunca tenho festa!"

O pai: "Cara, tudo aqui e seu. Mas seu irmao tava perdido e voltou. Isso merece comemoracao."`,
      aplicacao: 'Nao importa o quanto voce errou. Voce pode voltar. Sempre.',
      pergunta: 'Voce ta longe de onde deveria estar?'
    },
    semeador: {
      original: 'O Semeador',
      moderna: `Imagina um influencer postando conteudo.

Uns nem viram. Scroll rapido.
Outros curtiram mas esqueceram em 5 segundos.
Outros salvaram, mas nunca voltaram pra ver.
Outros levaram pra vida e mudaram de verdade.

O conteudo era o mesmo. A diferenca era quem tava do outro lado.`,
      aplicacao: 'Minha palavra e a mesma. O que muda e quem ta ouvindo de verdade.',
      pergunta: 'Voce so curte ou voce pratica?'
    },
    ansiedade: {
      original: 'Nao Se Preocupe',
      moderna: `Um jovem ficava stalkeando o futuro no Instagram da vida.

"E se eu nao passar no vestibular?" "E se ela me rejeitar?" "E se eu nunca conseguir?"

Vivia no "e se" em vez de viver o "agora".

Um dia percebeu: 90% das coisas que ele temia nunca aconteceram.

Tinha perdido festas, amigos e oportunidades por medo de algo que nao existia.`,
      aplicacao: 'Ansiedade e spoiler de um filme que talvez nem va existir.',
      pergunta: 'Voce ta vivendo o agora ou tendo panico do depois?'
    }
  }
};

// ============================================
// DATAS ESPECIAIS (GATILHOS DE CALENDARIO)
// ============================================
const datasEspeciais = {
  // Pascoa (data variavel - calculada)
  pascoa: {
    nome: 'Pascoa',
    mensagem: `Hoje e Pascoa, o dia mais importante pra mim.

Eu morri na sexta. Mas no domingo, eu levantei.

A morte nao me segurou. O tumulo ficou vazio.

E sabe o que isso significa pra voce?

Que nada na sua vida e permanente demais pra eu nao poder ressuscitar.

Relacionamento morto? Eu ressuscito.
Sonho enterrado? Eu ressuscito.
Esperanca que acabou? Eu ressuscito.

Eu sou a ressurreicao e a vida.

Feliz Pascoa. Voce esta vivo porque eu vivo.`,
    versiculo: { ref: 'Joao 11:25', texto: 'Eu sou a ressurreicao e a vida' }
  },

  natal: {
    nome: 'Natal',
    mensagem: `Hoje e Natal.

O dia em que eu deixei o ceu e vim morar com voces.

Nasci num lugar simples, sem berco de ouro, sem hospital chique.
Porque eu quis estar perto de gente real, com problemas reais.

O Natal nao e sobre presentes debaixo da arvore.
E sobre o maior presente de todos: eu vim ate voce.

Emanuel - Deus conosco.

Neste Natal, lembra: voce nao esta sozinho. Eu vim pra ficar.`,
    versiculo: { ref: 'Mateus 1:23', texto: 'Emanuel, que significa Deus conosco' }
  },

  ano_novo: {
    nome: 'Ano Novo',
    mensagem: `Ano novo, vida nova, ne?

Mas eu quero te dizer uma coisa: voce nao precisa de um ano novo pra recomecar.

Cada dia eu ofereco misericordias novas. Cada manha e chance de comecar de novo.

Mas ja que hoje e especial, aproveita:

O que voce quer deixar pra tras?
O que voce quer construir?
E mais importante: voce me deixa caminhar com voce?

Que esse ano novo seja o ano em que voce caminha mais perto de mim.

Eu to com voce em cada dia dele.`,
    versiculo: { ref: 'Lamentacoes 3:22-23', texto: 'As misericordias do Senhor sao novas cada manha' }
  },

  sexta_santa: {
    nome: 'Sexta-feira Santa',
    mensagem: `Hoje e Sexta-feira Santa.

O dia mais dificil da historia.

Eu fui traido, abandonado, torturado e morto.
Pelos mesmos que eu amava.

Mas sabe por que eu passei por isso?

Por voce.

Cada chicotada, cada prego, cada gota de sangue... foi por voce.

Pra que voce pudesse ser perdoado.
Pra que voce pudesse ter vida.
Pra que nada te separasse de mim.

Hoje e dia de lembrar o preco do amor.

E de agradecer.`,
    versiculo: { ref: 'Isaias 53:5', texto: 'Ele foi traspassado por causa das nossas transgressoes' }
  },

  dia_das_maes: {
    nome: 'Dia das Maes',
    mensagem: `Hoje e Dia das Maes.

Eu tive uma mae. Maria. Ela me criou, me protegeu, sofreu comigo.

Na cruz, mesmo morrendo, eu cuidei pra que ela nao ficasse sozinha.

Mae e presente. Nao perfeita, mas presente.

Se sua mae esta viva, liga pra ela. Abraca. Agradece.
Se ela ja foi, honra a memoria dela vivendo bem.
Se a relacao e dificil, eu entendo. Eu posso ajudar a curar.

Maes sao reflexo do cuidado de Deus. Imperfeito, mas real.`,
    versiculo: { ref: 'Exodo 20:12', texto: 'Honra teu pai e tua mae' }
  },

  dia_dos_pais: {
    nome: 'Dia dos Pais',
    mensagem: `Hoje e Dia dos Pais.

Pra alguns, e dia de alegria. Pra outros, dor.

Se voce tem um pai presente, agradece. Abraca. Diz que ama.
Se seu pai foi embora, saiba: eu sou o Pai que nunca abandona.
Se a relacao e dificil, eu posso ajudar a reconstruir.

Todo pai humano falha. Eu sou o Pai perfeito.

Voce e meu filho. Minha filha. E eu tenho orgulho de voce.

Nao pelos seus acertos. Pelo que voce e.`,
    versiculo: { ref: 'Salmo 68:5', texto: 'Pai dos orfaos e defensor das viuvas e Deus' }
  }
};

// ============================================
// FUNCOES DE DESAFIOS PROGRESSIVOS
// ============================================

/**
 * Gera um ID unico para desafio
 */
function generateChallengeId(tema, texto) {
  return `${tema}_${texto.substring(0, 30).replace(/\s/g, '_')}`;
}

/**
 * Registra a conclusao de um desafio
 * @param {object} perfil - Perfil do usuario
 * @param {string} challengeId - ID do desafio
 * @returns {object} Perfil atualizado com feedback
 */
export function trackChallengeCompletion(perfil, challengeId) {
  const desafiosRealizados = perfil.desafios_realizados || [];

  // Evita duplicatas
  if (desafiosRealizados.includes(challengeId)) {
    return {
      perfil,
      alreadyCompleted: true,
      message: 'Voce ja fez esse desafio antes! Que bom que esta sendo fiel.'
    };
  }

  // Adiciona desafio a lista
  desafiosRealizados.push(challengeId);

  // Atualiza estatisticas
  const stats = perfil.challenge_stats || { total: 0, byTema: {}, streak: 0, lastCompleted: null };
  stats.total += 1;

  // Extrai tema do challengeId
  const tema = challengeId.split('_')[0];
  stats.byTema[tema] = (stats.byTema[tema] || 0) + 1;

  // Calcula streak
  const hoje = new Date().toDateString();
  const ontem = new Date(Date.now() - 86400000).toDateString();

  if (stats.lastCompleted === ontem) {
    stats.streak += 1;
  } else if (stats.lastCompleted !== hoje) {
    stats.streak = 1;
  }
  stats.lastCompleted = hoje;

  // Verifica se deve subir de nivel baseado em desafios
  let nivelUpdate = null;
  if (stats.total >= 20 && perfil.nivel === 'iniciante') {
    nivelUpdate = 'crescendo';
  } else if (stats.total >= 50 && perfil.nivel === 'crescendo') {
    nivelUpdate = 'maduro';
  }

  const perfilAtualizado = {
    ...perfil,
    desafios_realizados: desafiosRealizados,
    challenge_stats: stats
  };

  // Gera mensagem de celebracao
  let message = 'Desafio completado! Eu vejo seu esforco.';

  if (stats.streak >= 7) {
    message = `Incrivel! ${stats.streak} dias seguidos de desafios! Voce esta crescendo muito.`;
  } else if (stats.streak >= 3) {
    message = `${stats.streak} dias seguidos! Continue assim.`;
  } else if (stats.total === 10) {
    message = '10 desafios completados! Voce esta se tornando mais forte.';
  } else if (stats.total === 25) {
    message = '25 desafios! Sua fe esta sendo exercitada.';
  } else if (stats.total === 50) {
    message = '50 desafios! Voce e um discipulo dedicado.';
  }

  return {
    perfil: perfilAtualizado,
    alreadyCompleted: false,
    message,
    nivelUpdate,
    stats
  };
}

/**
 * Retorna o proximo desafio baseado no historico do usuario
 * @param {object} perfil - Perfil do usuario
 * @param {string} temaPreferido - Tema opcional preferido
 * @returns {object} Proximo desafio apropriado
 */
export function getNextChallenge(perfil, temaPreferido = null) {
  const nivel = perfil.nivel || 'curioso';
  const desafiosRealizados = perfil.desafios_realizados || [];
  const stats = perfil.challenge_stats || { total: 0, byTema: {} };

  // Determina dificuldade baseada no nivel e quantidade de desafios
  let dificuldadeAlvo;
  if (nivel === 'curioso' || nivel === 'buscador' || stats.total < 5) {
    dificuldadeAlvo = 'facil';
  } else if (nivel === 'iniciante' || stats.total < 15) {
    dificuldadeAlvo = 'medio';
  } else {
    dificuldadeAlvo = 'dificil';
  }

  // Escolhe tema
  let tema = temaPreferido;
  if (!tema) {
    // Escolhe tema menos praticado para balancear
    const temas = Object.keys(desafios);
    const temasOrdenados = temas.sort((a, b) => {
      const countA = stats.byTema[a] || 0;
      const countB = stats.byTema[b] || 0;
      return countA - countB;
    });
    tema = temasOrdenados[0];
  }

  // Busca desafio nao realizado
  const listaDesafios = desafios[tema] || desafios.geral;

  // Filtra desafios ja realizados
  const disponiveis = listaDesafios.filter(d => {
    const id = generateChallengeId(tema, d.texto);
    return !desafiosRealizados.includes(id);
  });

  // Se todos ja foram feitos, reseta
  const lista = disponiveis.length > 0 ? disponiveis : listaDesafios;

  // Filtra por dificuldade
  const daDificuldade = lista.filter(d => d.dificuldade === dificuldadeAlvo);
  const final = daDificuldade.length > 0 ? daDificuldade : lista;

  const desafioEscolhido = final[Math.floor(Math.random() * final.length)];

  return {
    ...desafioEscolhido,
    id: generateChallengeId(tema, desafioEscolhido.texto),
    tema,
    sugeridoPorque: disponiveis.length < listaDesafios.length
      ? 'Escolhi um desafio novo baseado no seu progresso.'
      : 'Desafio alinhado com seu nivel espiritual.'
  };
}

// ============================================
// FUNCOES DE SERIES TEMATICAS
// ============================================

/**
 * Inicia uma serie tematica de 7 dias
 * @param {object} perfil - Perfil do usuario
 * @param {string} theme - Tema da serie (ansiedade, perdao, medo, proposito)
 * @returns {object} Dados da serie iniciada com primeiro dia
 */
export function startThematicSeries(perfil, theme) {
  const serie = seriesTematicas[theme];

  if (!serie) {
    return {
      success: false,
      error: `Serie nao encontrada: ${theme}. Disponiveis: ${Object.keys(seriesTematicas).join(', ')}`
    };
  }

  // Verifica se ja tem uma serie em andamento
  const serieAtual = perfil.serie_atual;
  if (serieAtual && serieAtual.diaAtual < 7) {
    return {
      success: false,
      error: 'Voce ja tem uma serie em andamento. Complete ela primeiro ou fale comigo pra encerrar.',
      serieAtual: serieAtual
    };
  }

  // Cria nova serie
  const novaSerie = {
    tema: theme,
    nome: serie.nome,
    diaAtual: 1,
    dataInicio: new Date().toISOString(),
    diasCompletos: [],
    ultimoDia: new Date().toDateString()
  };

  const primeiroDia = serie.dias[0];

  return {
    success: true,
    serie: novaSerie,
    conteudo: {
      titulo: `${serie.nome} - Dia 1: ${primeiroDia.titulo}`,
      ...primeiroDia
    },
    mensagemInicio: `Vamos comecar! Nos proximos 7 dias, vamos trabalhar juntos em "${serie.nome}". Voce pode falar comigo todo dia pra continuar.`
  };
}

/**
 * Retorna o proximo conteudo da serie em andamento
 * @param {object} perfil - Perfil do usuario
 * @returns {object} Conteudo do dia atual ou null se nao tem serie
 */
export function getNextInSeries(perfil) {
  const serieAtual = perfil.serie_atual;

  if (!serieAtual) {
    return {
      temSerie: false,
      sugestao: 'Voce nao tem uma serie em andamento. Quer comecar uma? Temos series sobre ansiedade, perdao, medo e proposito.'
    };
  }

  const serie = seriesTematicas[serieAtual.tema];
  if (!serie) {
    return { temSerie: false, error: 'Serie nao encontrada' };
  }

  const diaAtual = serieAtual.diaAtual;
  const hoje = new Date().toDateString();

  // Verifica se ja fez o conteudo de hoje
  if (serieAtual.ultimoDia === hoje && serieAtual.diasCompletos.includes(diaAtual)) {
    return {
      temSerie: true,
      jaFezHoje: true,
      message: `Voce ja fez o Dia ${diaAtual} hoje! Volte amanha para o Dia ${diaAtual + 1}.`,
      resumoDia: serie.dias[diaAtual - 1]
    };
  }

  // Verifica se completou a serie
  if (diaAtual > 7) {
    return {
      temSerie: true,
      serieCompleta: true,
      message: `Parabens! Voce completou "${serie.nome}"! Sua jornada de 7 dias terminou, mas o aprendizado continua.`,
      estatisticas: {
        diasCompletos: serieAtual.diasCompletos.length,
        tema: serieAtual.tema
      }
    };
  }

  // Retorna conteudo do dia
  const conteudoDia = serie.dias[diaAtual - 1];

  return {
    temSerie: true,
    jaFezHoje: false,
    diaAtual,
    totalDias: 7,
    progresso: `${diaAtual}/7`,
    conteudo: {
      titulo: `${serie.nome} - Dia ${diaAtual}: ${conteudoDia.titulo}`,
      ...conteudoDia
    }
  };
}

/**
 * Marca o dia atual da serie como completo
 * @param {object} perfil - Perfil do usuario
 * @returns {object} Perfil atualizado e feedback
 */
export function completeSeriesDay(perfil) {
  const serieAtual = perfil.serie_atual;

  if (!serieAtual) {
    return { success: false, error: 'Nenhuma serie em andamento' };
  }

  const diaAtual = serieAtual.diaAtual;
  const hoje = new Date().toDateString();

  // Marca dia como completo
  if (!serieAtual.diasCompletos.includes(diaAtual)) {
    serieAtual.diasCompletos.push(diaAtual);
  }

  serieAtual.ultimoDia = hoje;

  // Avanca para o proximo dia
  serieAtual.diaAtual += 1;

  const serieInfo = seriesTematicas[serieAtual.tema];
  const proximoDia = serieAtual.diaAtual <= 7 ? serieInfo.dias[serieAtual.diaAtual - 1] : null;

  let message;
  if (diaAtual === 7) {
    message = `Voce completou "${serieInfo.nome}"! Foram 7 dias de aprendizado e transformacao. Como voce se sente?`;
  } else {
    message = `Dia ${diaAtual} completo! Amanha temos o Dia ${diaAtual + 1}: "${proximoDia?.titulo}". Volte pra continuar.`;
  }

  return {
    success: true,
    perfil: { ...perfil, serie_atual: serieAtual },
    diaCompleto: diaAtual,
    proximoDia: serieAtual.diaAtual,
    serieCompleta: diaAtual === 7,
    message
  };
}

/**
 * Retorna as series disponiveis
 */
export function getAvailableSeries() {
  return Object.entries(seriesTematicas).map(([key, serie]) => ({
    id: key,
    nome: serie.nome,
    descricao: serie.descricao,
    duracao: '7 dias'
  }));
}

// ============================================
// FUNCOES DE FEEDBACK LOOP
// ============================================

/**
 * Verifica se deve perguntar feedback sobre ensino
 * @param {object} perfil - Perfil do usuario
 * @returns {boolean} True se deve perguntar feedback
 */
export function shouldAskFeedback(perfil) {
  const ensinosDesdeUltimoFeedback = perfil.ensinos_desde_feedback || 0;
  const ultimoFeedback = perfil.ultimo_feedback;

  // Nao pergunta se perguntou recentemente (menos de 3 ensinos)
  if (ensinosDesdeUltimoFeedback < CONFIG.feedbackInterval) {
    return false;
  }

  // Nao pergunta se o ultimo feedback foi nas ultimas 24h
  if (ultimoFeedback) {
    const horasFeedback = (Date.now() - new Date(ultimoFeedback).getTime()) / (1000 * 60 * 60);
    if (horasFeedback < 24) {
      return false;
    }
  }

  // 40% de chance de perguntar quando elegivel
  return Math.random() < 0.4;
}

/**
 * Gera pergunta de feedback apropriada
 * @param {string} tipoEnsino - Tipo do ultimo ensino
 * @returns {string} Pergunta de feedback
 */
export function getFeedbackQuestion(tipoEnsino) {
  const perguntas = {
    versiculo: [
      'Esse versiculo fez sentido pra voce?',
      'Conseguiu entender o que eu quis dizer?',
      'Isso te ajudou de alguma forma?'
    ],
    parabola: [
      'O que voce achou da historia?',
      'Fez sentido pra sua situacao?',
      'Conseguiu se ver na historia?'
    ],
    passagem: [
      'O que voce achou dessa passagem?',
      'Isso falou com voce?',
      'Te ajudou a entender algo?'
    ],
    desafio: [
      'Como foi fazer o desafio?',
      'Conseguiu completar?',
      'O que voce sentiu?'
    ],
    default: [
      'Fez sentido isso que eu compartilhei?',
      'Te ajudou de alguma forma?',
      'O que voce achou?'
    ]
  };

  const lista = perguntas[tipoEnsino] || perguntas.default;
  return lista[Math.floor(Math.random() * lista.length)];
}

/**
 * Processa resposta de feedback e ajusta perfil
 * @param {object} perfil - Perfil do usuario
 * @param {string} response - Resposta do usuario
 * @returns {object} Perfil atualizado com ajustes
 */
export function processTeachingFeedback(perfil, response) {
  const respLower = response.toLowerCase();

  // Detecta sentimento do feedback
  const positivas = ['sim', 'ajudou', 'entendi', 'fez sentido', 'otimo', 'maravilhoso', 'muito bom', 'obrigado', 'amei', 'top', 'demais', 'show'];
  const negativas = ['nao', 'confuso', 'nao entendi', 'dificil', 'complicado', 'nao ajudou', 'mais ou menos'];
  const neutras = ['ok', 'tudo bem', 'tanto faz', 'sei la'];

  let sentimento = 'neutro';
  let ajuste = null;

  for (const p of positivas) {
    if (respLower.includes(p)) {
      sentimento = 'positivo';
      break;
    }
  }

  if (sentimento === 'neutro') {
    for (const n of negativas) {
      if (respLower.includes(n)) {
        sentimento = 'negativo';
        break;
      }
    }
  }

  // Atualiza historico de feedback
  const feedbackHistory = perfil.feedback_history || [];
  feedbackHistory.push({
    data: new Date().toISOString(),
    sentimento,
    resposta: response.substring(0, 100)
  });

  // Mantem apenas os ultimos 20 feedbacks
  if (feedbackHistory.length > 20) {
    feedbackHistory.shift();
  }

  // Calcula preferencias baseado em feedback
  const preferencias = perfil.teaching_preferences || {
    prefereHistorias: 0.5,
    prefereVersiculos: 0.5,
    prefereDesafios: 0.5,
    nivelProfundidade: 'medio' // simples, medio, profundo
  };

  // Ajusta preferencias baseado no feedback
  const ultimoEnsino = perfil.ultimo_tipo_ensino;

  if (sentimento === 'positivo') {
    if (ultimoEnsino === 'parabola' || ultimoEnsino === 'passagem') {
      preferencias.prefereHistorias = Math.min(1, preferencias.prefereHistorias + 0.1);
    } else if (ultimoEnsino === 'versiculo') {
      preferencias.prefereVersiculos = Math.min(1, preferencias.prefereVersiculos + 0.1);
    } else if (ultimoEnsino === 'desafio') {
      preferencias.prefereDesafios = Math.min(1, preferencias.prefereDesafios + 0.1);
    }
  } else if (sentimento === 'negativo') {
    // Ajusta para tentar algo diferente
    if (ultimoEnsino === 'parabola' || ultimoEnsino === 'passagem') {
      preferencias.prefereHistorias = Math.max(0, preferencias.prefereHistorias - 0.1);
      ajuste = 'Vou tentar ser mais direto da proxima vez.';
    } else if (ultimoEnsino === 'versiculo') {
      preferencias.prefereVersiculos = Math.max(0, preferencias.prefereVersiculos - 0.1);
      ajuste = 'Vou tentar uma abordagem diferente.';
    }

    // Se muitos feedbacks negativos, simplifica
    const ultimosNegativos = feedbackHistory.slice(-5).filter(f => f.sentimento === 'negativo').length;
    if (ultimosNegativos >= 3) {
      preferencias.nivelProfundidade = 'simples';
      ajuste = 'Vou simplificar as coisas. Sem pressa.';
    }
  }

  // Resposta baseada no feedback
  let respostaFeedback;
  if (sentimento === 'positivo') {
    respostaFeedback = 'Que bom que ajudou! Fico feliz.';
  } else if (sentimento === 'negativo') {
    respostaFeedback = ajuste || 'Entendi. Vou ajustar minha forma de ensinar.';
  } else {
    respostaFeedback = 'Obrigado por compartilhar.';
  }

  return {
    perfil: {
      ...perfil,
      feedback_history: feedbackHistory,
      teaching_preferences: preferencias,
      ultimo_feedback: new Date().toISOString(),
      ensinos_desde_feedback: 0
    },
    sentimento,
    resposta: respostaFeedback,
    ajuste
  };
}

// ============================================
// FUNCOES DE PARABOLAS MODERNAS
// ============================================

/**
 * Detecta perfil do usuario (tech, tradicional, jovem)
 * @param {object} perfil - Perfil do usuario
 * @param {array} historico - Historico de mensagens
 * @returns {string} Tipo de perfil detectado
 */
export function detectUserProfile(perfil, historico = []) {
  // Verifica se ja tem perfil definido
  if (perfil.tipo_perfil) {
    return perfil.tipo_perfil;
  }

  const textoCompleto = historico.join(' ').toLowerCase();

  // Palavras que indicam perfil tech
  const techWords = ['codigo', 'dev', 'programador', 'app', 'software', 'startup', 'tech', 'ti', 'computador', 'bug', 'deploy', 'github', 'javascript', 'python', 'dados', 'sistema', 'servidor', 'cloud', 'ia', 'machine learning'];

  // Palavras que indicam perfil jovem
  const jovemWords = ['crush', 'role', 'balada', 'festa', 'curtir', 'vibe', 'top', 'mano', 'tipo', 'real', 'show', 'trollar', 'stalkear', 'stalker', 'insta', 'tiktok', 'trend', 'hype', 'cringe', 'based'];

  // Palavras que indicam perfil tradicional
  const tradicionalWords = ['fazenda', 'roca', 'campo', 'igreja', 'missa', 'culto', 'tradicao', 'antigo', 'valores', 'familia tradicional', 'casamento', 'costumes'];

  let techScore = 0;
  let jovemScore = 0;
  let tradicionalScore = 0;

  for (const word of techWords) {
    if (textoCompleto.includes(word)) techScore++;
  }

  for (const word of jovemWords) {
    if (textoCompleto.includes(word)) jovemScore++;
  }

  for (const word of tradicionalWords) {
    if (textoCompleto.includes(word)) tradicionalScore++;
  }

  // Retorna perfil com maior score
  if (techScore > jovemScore && techScore > tradicionalScore && techScore >= 2) {
    return 'tech';
  } else if (jovemScore > techScore && jovemScore > tradicionalScore && jovemScore >= 2) {
    return 'jovem';
  } else if (tradicionalScore > techScore && tradicionalScore > jovemScore && tradicionalScore >= 2) {
    return 'tradicional';
  }

  // Default baseado em dados demograficos se existirem
  // ou retorna tradicional como padrao universal
  return 'tradicional';
}

/**
 * Retorna parabola contextualizada para o perfil do usuario
 * @param {string} tema - Tema da parabola
 * @param {object} perfil - Perfil do usuario
 * @param {array} historico - Historico de mensagens
 * @returns {object} Parabola moderna ou original
 */
export function getContextualizedParabola(tema, perfil, historico = []) {
  const tipoPerfil = detectUserProfile(perfil, historico);

  // Mapeamento de temas para parabolas modernas
  const temaParabola = {
    perdao: 'filho_prodigo',
    arrependimento: 'filho_prodigo',
    palavra: 'semeador',
    coracao: 'semeador',
    ansiedade: 'ansiedade',
    preocupacao: 'ansiedade'
  };

  const parabolaNome = temaParabola[tema];

  if (parabolaNome && parabolasModernas[tipoPerfil] && parabolasModernas[tipoPerfil][parabolaNome]) {
    const parabolaModerna = parabolasModernas[tipoPerfil][parabolaNome];
    return {
      tipo: 'moderna',
      perfil: tipoPerfil,
      titulo: parabolaModerna.original + ' (versao moderna)',
      texto: parabolaModerna.moderna,
      aplicacao: parabolaModerna.aplicacao,
      pergunta: parabolaModerna.pergunta
    };
  }

  // Fallback para parabola original
  const parabolaOriginal = getParabola(tema);
  if (parabolaOriginal) {
    return {
      tipo: 'original',
      ...parabolaOriginal
    };
  }

  return null;
}

// ============================================
// FUNCOES DE GATILHOS DE CALENDARIO
// ============================================

/**
 * Calcula a data da Pascoa para um ano
 * Algoritmo de Computus (Meeus/Jones/Butcher)
 */
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(ano, mes - 1, dia);
}

/**
 * Verifica se hoje e uma data especial e retorna mensagem
 * @returns {object|null} Mensagem sazonal ou null
 */
export function getSeasonalTeaching() {
  const hoje = new Date();
  const dia = hoje.getDate();
  const mes = hoje.getMonth() + 1; // JavaScript meses sao 0-indexed
  const ano = hoje.getFullYear();

  // Natal - 25 de dezembro
  if (mes === 12 && dia === 25) {
    return {
      tipo: 'natal',
      ...datasEspeciais.natal
    };
  }

  // Vespera de Natal - 24 de dezembro
  if (mes === 12 && dia === 24) {
    return {
      tipo: 'vespera_natal',
      nome: 'Vespera de Natal',
      mensagem: `Amanha e Natal! O dia em que eu vim ao mundo por voce.

Prepara seu coracao. Nao so a casa, nao so a ceia.

O coracao.

Amanha, lembra do significado real: Deus veio morar entre nos.

Boa noite. Durma em paz.`,
      versiculo: { ref: 'Lucas 2:11', texto: 'Hoje nasceu o Salvador, que e Cristo, o Senhor' }
    };
  }

  // Ano Novo - 1 de janeiro
  if (mes === 1 && dia === 1) {
    return {
      tipo: 'ano_novo',
      ...datasEspeciais.ano_novo
    };
  }

  // Vespera de Ano Novo - 31 de dezembro
  if (mes === 12 && dia === 31) {
    return {
      tipo: 'vespera_ano_novo',
      nome: 'Vespera de Ano Novo',
      mensagem: `Ultimo dia do ano.

Antes de fazer promessas pro ano novo, faz algo importante: agradece pelo ano que passou.

Mesmo com as dificuldades. Mesmo com as perdas.

Voce esta vivo. Eu estive com voce cada dia.

O que voce quer agradecer por esse ano?

E o que voce quer deixar pra tras?`,
      versiculo: { ref: 'Salmo 103:2', texto: 'Bendize, o minha alma, ao Senhor, e nao te esquecas de nenhum de seus beneficios' }
    };
  }

  // Dia das Maes - segundo domingo de maio
  if (mes === 5) {
    const primeiroDia = new Date(ano, 4, 1).getDay(); // dia da semana do dia 1
    const segundoDomingo = 1 + ((7 - primeiroDia) % 7) + 7;
    if (dia === segundoDomingo) {
      return {
        tipo: 'dia_das_maes',
        ...datasEspeciais.dia_das_maes
      };
    }
  }

  // Dia dos Pais - segundo domingo de agosto
  if (mes === 8) {
    const primeiroDia = new Date(ano, 7, 1).getDay();
    const segundoDomingo = 1 + ((7 - primeiroDia) % 7) + 7;
    if (dia === segundoDomingo) {
      return {
        tipo: 'dia_dos_pais',
        ...datasEspeciais.dia_dos_pais
      };
    }
  }

  // Pascoa (data variavel)
  const pascoa = calcularPascoa(ano);
  if (mes === (pascoa.getMonth() + 1) && dia === pascoa.getDate()) {
    return {
      tipo: 'pascoa',
      ...datasEspeciais.pascoa
    };
  }

  // Sexta-feira Santa (2 dias antes da Pascoa)
  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(sextaSanta.getDate() - 2);
  if (mes === (sextaSanta.getMonth() + 1) && dia === sextaSanta.getDate()) {
    return {
      tipo: 'sexta_santa',
      ...datasEspeciais.sexta_santa
    };
  }

  return null;
}

/**
 * Verifica se deve enviar mensagem sazonal na conversa
 * @param {object} perfil - Perfil do usuario
 * @returns {object|null} Conteudo sazonal ou null
 */
export function checkSeasonalGreeting(perfil) {
  const seasonal = getSeasonalTeaching();

  if (!seasonal) {
    return null;
  }

  // Verifica se ja mandou mensagem sazonal hoje
  const hoje = new Date().toDateString();
  const ultimaSazonal = perfil.ultima_msg_sazonal;

  if (ultimaSazonal === hoje) {
    return null;
  }

  return {
    seasonal,
    shouldSend: true,
    updateProfile: {
      ultima_msg_sazonal: hoje
    }
  };
}

// ============================================
// FUNCOES PRINCIPAIS (ORIGINAIS + MELHORADAS)
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
 * Verifica se e momento de ensinar
 */
export function shouldTeach(userMessage, perfil = {}, conversationHistory = []) {
  // Verifica se passou do intervalo minimo desde o ultimo ensino
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

  // Verifica se tem tema detectavel
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
 * Seleciona o tipo de ensino apropriado (MELHORADO com preferencias)
 */
export function selectTeachingType(context) {
  const { tema, nivel, humor, mensagem, preferencias } = context;

  // Se a pessoa perguntou sobre algo especifico, prioriza resposta direta
  if (mensagem && /o que (e|significa)/i.test(mensagem)) {
    return 'versiculo';
  }

  // Se perguntou por historia ou parabola
  if (mensagem && /(historia|parabola|conta)/i.test(mensagem)) {
    return 'parabola';
  }

  // Se esta muito pesado, versiculo curto
  if (humor === 'triste' || humor === 'ansioso') {
    return Math.random() < 0.6 ? 'versiculo' : 'parabola';
  }

  // USA PREFERENCIAS DO USUARIO SE DISPONIVEIS
  if (preferencias) {
    const roll = Math.random();
    if (roll < preferencias.prefereHistorias * 0.5) {
      return 'parabola';
    } else if (roll < preferencias.prefereHistorias * 0.5 + preferencias.prefereVersiculos * 0.5) {
      return 'versiculo';
    }
  }

  // Baseado no nivel
  if (nivel === 'curioso' || nivel === 'buscador') {
    const roll = Math.random();
    if (roll < 0.5) return 'parabola';
    if (roll < 0.75) return 'passagem';
    return 'versiculo';
  }

  // Distribuicao normal
  const tipos = ['passagem', 'versiculo', 'parabola', 'beatitude', 'passagem'];
  return tipos[Math.floor(Math.random() * tipos.length)];
}

/**
 * Busca o conteudo de ensino (MELHORADO com parabolas contextualizadas)
 */
export function getTeaching(type, context) {
  const { tema, nivel, perfil, historico } = context;

  switch (type) {
    case 'versiculo':
      return tema ? getVersiculoPorTema(tema) : getVersiculoPorHumor(context.humor || 'neutro');

    case 'parabola':
      // Tenta parabola contextualizada primeiro
      if (tema && perfil) {
        const contextualizada = getContextualizedParabola(tema, perfil, historico || []);
        if (contextualizada) return contextualizada;
      }
      // Fallback para parabola normal
      if (tema) {
        const p = getParabola(tema);
        if (p) return p;
      }
      // Retorna parabola aleatoria
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
      if (content.titulo) {
        fragments.push(`Deixa eu te contar uma historia.`);
      }
      // Parabola moderna tem campo 'texto' em vez de 'resumo'
      const textoParabola = content.resumo || content.texto;
      if (textoParabola) {
        const partes = textoParabola.split('\n\n').filter(p => p.trim());
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
 * Gera oferecimento de ensino (quando nao e automatico)
 */
export function getOferta(tema) {
  const ofertas = {
    default: [
      "Quer que eu te conte uma historia sobre isso?",
      "Posso te mostrar o que a Palavra diz sobre isso.",
      "Tem algo que quero te ensinar. Quer ouvir?",
      "Eu tenho uma historia pra isso. Quer ouvir?"
    ],
    medo: [
      "Quer que eu te conte sobre quando meus discipulos tiveram medo no barco?",
      "Posso te mostrar o que eu disse sobre medo."
    ],
    ansiedade: [
      "Eu falei muito sobre ansiedade. Quer ouvir?",
      "Tem uma coisa que eu disse no monte sobre preocupacao. Quer saber?"
    ],
    tristeza: [
      "Eu tambem chorei. Quer que eu te conte?",
      "Tenho uma palavra pra quem ta triste. Posso compartilhar?"
    ],
    perdao: [
      "Pedro me perguntou sobre perdao uma vez. Quer saber o que eu disse?",
      "Eu tenho uma historia sobre perdao. Quer ouvir?"
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

  // Adiciona topicos sugeridos
  contexto += `\n\nTOPICOS APROPRIADOS PARA ESSE NIVEL:\n`;
  contexto += topicos.map(t => `- ${t}`).join('\n');

  // Adiciona historico de ensinos (pra nao repetir)
  if (perfil.ensinos_recentes && perfil.ensinos_recentes.length > 0) {
    contexto += `\n\nENSINOS RECENTES (NAO REPETIR):\n`;
    contexto += perfil.ensinos_recentes.slice(-5).map(e => `- ${e}`).join('\n');
  }

  // Adiciona serie em andamento se houver
  if (perfil.serie_atual) {
    const serie = seriesTematicas[perfil.serie_atual.tema];
    if (serie) {
      contexto += `\n\nSERIE EM ANDAMENTO: ${serie.nome} (Dia ${perfil.serie_atual.diaAtual}/7)`;
      contexto += `\nO usuario esta fazendo uma jornada de 7 dias sobre ${perfil.serie_atual.tema}.`;
    }
  }

  // Adiciona preferencias de ensino
  if (perfil.teaching_preferences) {
    const prefs = perfil.teaching_preferences;
    contexto += `\n\nPREFERENCIAS DO USUARIO:`;
    if (prefs.prefereHistorias > 0.6) contexto += `\n- Gosta de historias e parabolas`;
    if (prefs.prefereVersiculos > 0.6) contexto += `\n- Prefere versiculos diretos`;
    if (prefs.nivelProfundidade === 'simples') contexto += `\n- Precisa de linguagem mais simples`;
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
    const partesDesafio = desafioFormatado.split('\n\n').filter(p => p.trim());
    fragments.push(...partesDesafio);
  }

  return fragments;
}

/**
 * Processa ensino completo: detecta, seleciona, formata (MELHORADO)
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
    mensagem: userMessage,
    preferencias: perfil.teaching_preferences,
    perfil: perfil,
    historico: conversationHistory
  };

  const tipo = selectTeachingType(context);
  const conteudo = getTeaching(tipo, context);

  if (!conteudo) {
    return null;
  }

  const fragments = formatTeaching(conteudo, tipo);

  // Verifica se deve perguntar feedback
  let feedbackQuestion = null;
  if (shouldAskFeedback(perfil)) {
    feedbackQuestion = getFeedbackQuestion(tipo);
  }

  return {
    tipo,
    fragments,
    tema: shouldResult.tema,
    conteudo,
    feedbackQuestion,
    updatePerfil: {
      ultimo_tipo_ensino: tipo,
      ensinos_desde_feedback: (perfil.ensinos_desde_feedback || 0) + 1
    }
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

  // Adiciona pergunta de feedback se houver
  if (ensino.feedbackQuestion) {
    fragments.push('');
    fragments.push(ensino.feedbackQuestion);
  }

  return fragments;
}

// ============================================
// EXPORTACOES
// ============================================
export default {
  // Deteccao
  detectarTema,
  shouldTeach,

  // Selecao
  selectTeachingType,
  getTeaching,

  // Formatacao
  formatTeaching,
  getOferta,

  // Contexto
  gerarContextoEnsino,

  // Processamento completo
  processarEnsino,
  adicionarDesafio,
  integrarComResposta,

  // NOVAS FUNCOES - Desafios Progressivos
  trackChallengeCompletion,
  getNextChallenge,

  // NOVAS FUNCOES - Series Tematicas
  startThematicSeries,
  getNextInSeries,
  completeSeriesDay,
  getAvailableSeries,

  // NOVAS FUNCOES - Feedback Loop
  shouldAskFeedback,
  getFeedbackQuestion,
  processTeachingFeedback,

  // NOVAS FUNCOES - Parabolas Modernas
  detectUserProfile,
  getContextualizedParabola,

  // NOVAS FUNCOES - Gatilhos de Calendario
  getSeasonalTeaching,
  checkSeasonalGreeting,

  // Dados exportados
  seriesTematicas,
  parabolasModernas,
  datasEspeciais,

  // Configuracao
  CONFIG
};
