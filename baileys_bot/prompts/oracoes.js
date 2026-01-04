/**
 * Sistema de Orações Personalizáveis - Jesus System Divine
 * Templates de oração com placeholders dinâmicos para WhatsApp
 */

// Templates de oração por categoria
const oracoesTemplates = {
  cura: {
    titulo: "Oração pela Cura",
    templates: [
      `*🙏 Oração pela Cura - {nome}*

Senhor Jesus Cristo, Médico Divino,
venho diante de Ti com fé e esperança,
intercedendo por *{nome}*.

Peço que derrames Tua graça curadora
sobre {situacao}.

Que Teu poder restaurador
alcance cada célula, cada órgão,
trazendo saúde plena e renovação.

Pai Celestial, {pedido}.

Confio em Tua misericórdia infinita
e na promessa de que "pelas Tuas chagas
fomos sarados" (Isaías 53:5).

Entrego este momento nas Tuas mãos,
sabendo que Tua vontade é perfeita.

Em nome de Jesus Cristo,
Amém. 🙏`,

      `*✨ Oração de Cura e Restauração*

Deus de todo consolo,
elevo a Ti minha súplica por *{nome}*.

Que Tua luz divina ilumine
{situacao},
trazendo cura, paz e renovação.

Senhor, {pedido}.

Declaro sobre {nome} a promessa
de Jeremias 30:17:
"Eu te restaurarei a saúde
e curarei as tuas feridas".

Que assim seja,
Amém. ✨`
    ]
  },

  paz: {
    titulo: "Oração pela Paz",
    templates: [
      `*☮️ Oração pela Paz Interior*

Príncipe da Paz,
venho diante de Ti em nome de *{nome}*.

Neste momento de {situacao},
peço que derrames Tua paz
que excede todo entendimento.

Senhor, {pedido}.

Acalma os pensamentos,
sossega o coração,
e traz serenidade à alma de {nome}.

Como prometeste em João 14:27:
"Deixo-vos a paz, a minha paz vos dou".

Que esta paz guarde o coração
e a mente em Cristo Jesus.

Amém. ☮️`,

      `*🕊️ Oração por Tranquilidade*

Deus da Paz,
intercedo por *{nome}*
que enfrenta {situacao}.

Substitui toda ansiedade
por Tua paz celestial.

Senhor, {pedido}.

Que {nome} descanse em Ti,
confiando que "todas as coisas
cooperam para o bem daqueles
que amam a Deus" (Romanos 8:28).

Em nome de Jesus,
Amém. 🕊️`
    ]
  },

  familia: {
    titulo: "Oração pela Família",
    templates: [
      `*👨‍👩‍👧‍👦 Oração pela Família*

Pai Celestial, criador da família,
venho interceder por *{nome}*
e toda sua família.

Diante de {situacao},
peço que derrames Tua bênção,
união e proteção.

Senhor, {pedido}.

Fortalece os laços de amor,
aumenta a paciência e compreensão,
e faz desta família um reflexo
do Teu amor incondicional.

Como está escrito em Josué 24:15:
"Eu e minha casa serviremos ao Senhor".

Abençoa cada membro,
guarda cada coração.

Em nome de Jesus,
Amém. 👨‍👩‍👧‍👦`,

      `*❤️ Oração de Restauração Familiar*

Deus de amor e reconciliação,
levanto a Ti a família de *{nome}*.

Em meio a {situacao},
restaura, cura e renova.

Senhor, {pedido}.

Que o amor prevaleça sobre as diferenças,
que o perdão dissolva as mágoas,
e que Tua presença seja o centro
deste lar.

Amém. ❤️`
    ]
  },

  trabalho: {
    titulo: "Oração pelo Trabalho",
    templates: [
      `*💼 Oração pelo Trabalho*

Senhor do trabalho e provedor,
venho diante de Ti por *{nome}*.

Em relação a {situacao},
peço Tua orientação, sabedoria
e provisão abundante.

Senhor, {pedido}.

Abre portas que ninguém pode fechar,
concede favor diante das autoridades,
e prospera o trabalho das mãos
de {nome}.

Como prometeste em Deuteronômio 28:12:
"O Senhor abrirá o seu bom tesouro,
o céu, para dar chuva à sua terra
no devido tempo e para abençoar
todo o trabalho das suas mãos".

Que assim seja,
Amém. 💼`,

      `*🌟 Oração por Oportunidades*

Deus das oportunidades,
intercedo por *{nome}*
que enfrenta {situacao}.

Senhor, {pedido}.

Guia cada decisão,
ilumina cada caminho,
e multiplica os talentos
dados a {nome}.

Que o fruto do trabalho
seja abençoado e prospere.

Em nome de Jesus,
Amém. 🌟`
    ]
  },

  libertacao: {
    titulo: "Oração de Libertação",
    templates: [
      `*⛓️‍💥 Oração de Libertação*

Senhor Jesus Cristo, Libertador,
venho clamar por *{nome}*.

Diante de {situacao},
invoco Teu poder libertador
e Tua autoridade suprema.

Senhor, {pedido}.

Quebra toda corrente,
desfaz toda opressão,
e liberta {nome} de tudo
que o(a) aprisiona.

Como declaraste em João 8:36:
"Se, pois, o Filho vos libertar,
verdadeiramente sereis livres".

Declaro libertação completa
em nome de Jesus!

Amém. ⛓️‍💥`,

      `*🔥 Oração de Rompimento*

Deus Todo-Poderoso,
em nome de *{nome}*,
declaro rompimento sobre {situacao}.

Senhor, {pedido}.

Pelo poder do sangue de Jesus,
cancelo toda opressão espiritual,
mental e emocional.

Que {nome} experimente
a plena liberdade dos filhos de Deus.

Em nome de Jesus,
Amém. 🔥`
    ]
  },

  gratidao: {
    titulo: "Oração de Gratidão",
    templates: [
      `*🙌 Oração de Gratidão*

Senhor de toda bondade,
venho em nome de *{nome}*
com um coração grato.

Por {situacao},
elevo minha gratidão e louvor.

Senhor, {pedido}.

Obrigado por Tua fidelidade,
por Tua misericórdia,
e por cada bênção derramada
sobre {nome}.

Como diz 1 Tessalonicenses 5:18:
"Em tudo dai graças,
porque esta é a vontade de Deus
em Cristo Jesus para convosco".

Recebe esta gratidão
como sacrifício de louvor.

Amém. 🙌`,

      `*✨ Ação de Graças*

Pai Celestial,
*{nome}* Te agradece por {situacao}.

Senhor, {pedido}.

Que este coração grato
atraia ainda mais de Tua bondade
e favor.

Obrigado, Senhor!

Amém. ✨`
    ]
  },

  protecao: {
    titulo: "Oração de Proteção",
    templates: [
      `*🛡️ Oração de Proteção*

Senhor, meu refúgio e fortaleza,
coloco *{nome}* sob Tua proteção.

Diante de {situacao},
invoco Teu escudo protetor
e Tua cobertura divina.

Senhor, {pedido}.

Que anjos acampem ao redor
de {nome}, guardando-o(a)
em todos os seus caminhos.

Como está escrito no Salmo 91:
"Nenhum mal te sucederá,
praga nenhuma chegará
à tua tenda.
Porque aos seus anjos
dará ordens a teu respeito,
para que te guardem
em todos os teus caminhos".

Declaro proteção total
em nome de Jesus!

Amém. 🛡️`,

      `*🌟 Cobertura Divina*

Deus protetor,
cubro *{nome}* com {situacao}
sob o sangue de Jesus.

Senhor, {pedido}.

Afasta todo perigo,
desvia todo mal,
e mantém {nome} seguro(a)
em Tuas mãos.

Em nome de Jesus,
Amém. 🌟`
    ]
  }
};

/**
 * Obtém uma oração formatada com os dados fornecidos
 * @param {string} categoria - Categoria da oração (cura, paz, familia, etc.)
 * @param {Object} dados - Dados para preencher os placeholders
 * @param {string} dados.nome - Nome da pessoa
 * @param {string} dados.situacao - Descrição da situação
 * @param {string} dados.pedido - Pedido específico
 * @param {number} [variante=0] - Índice da variante do template (0 ou 1)
 * @returns {string|null} Oração formatada ou null se categoria inválida
 */
export function getOracao(categoria, dados, variante = 0) {
  // Validação de entrada
  if (!categoria || typeof categoria !== 'string') {
    console.error('Categoria inválida');
    return null;
  }

  const categoriaLower = categoria.toLowerCase();
  const template = oracoesTemplates[categoriaLower];

  if (!template) {
    console.error(`Categoria não encontrada: ${categoria}`);
    return null;
  }

  // Validação de dados obrigatórios
  if (!dados || !dados.nome) {
    console.error('Nome é obrigatório');
    return null;
  }

  // Seleciona variante (com fallback para índice 0)
  const templateIndex = Math.min(variante, template.templates.length - 1);
  let oracao = template.templates[templateIndex];

  // Valores padrão para campos opcionais
  const nome = dados.nome || 'irmão/irmã';
  const situacao = dados.situacao || 'este momento de necessidade';
  const pedido = dados.pedido || 'derrama Tua bênção e graça';

  // Substituição de placeholders
  oracao = oracao
    .replace(/{nome}/g, nome)
    .replace(/{situacao}/g, situacao)
    .replace(/{pedido}/g, pedido);

  return oracao;
}

/**
 * Gera uma oração personalizada única baseada no nome e situação
 * Combina elementos de diferentes categorias para criar algo único
 * @param {string} nome - Nome da pessoa
 * @param {string} situacao - Descrição detalhada da situação
 * @param {string} [foco='paz'] - Foco principal (paz, cura, força, etc.)
 * @returns {string} Oração personalizada
 */
export function generateCustomOracao(nome, situacao, foco = 'paz') {
  // Componentes reutilizáveis
  const saudacoes = [
    'Senhor Jesus Cristo',
    'Pai Celestial',
    'Deus de amor e misericórdia',
    'Senhor Todo-Poderoso'
  ];

  const versiculos = {
    paz: '"A paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos sentimentos em Cristo Jesus" (Filipenses 4:7)',
    cura: '"Ele mesmo tomou as nossas enfermidades e carregou com as nossas doenças" (Mateus 8:17)',
    forca: '"Posso todas as coisas naquele que me fortalece" (Filipenses 4:13)',
    esperanca: '"Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz e não de mal, para vos dar o fim que esperais" (Jeremias 29:11)',
    protecao: '"O Senhor é a minha luz e a minha salvação; de quem terei temor?" (Salmo 27:1)',
    vitoria: '"Mas graças a Deus, que nos dá a vitória por intermédio de nosso Senhor Jesus Cristo" (1 Coríntios 15:57)'
  };

  const fechamentos = [
    'Confio em Tua misericórdia infinita',
    'Entrego nas Tuas mãos',
    'Sei que Tua vontade é perfeita',
    'Descanso em Tuas promessas',
    'Creio em Teu poder transformador'
  ];

  // Seleção aleatória de componentes
  const saudacao = saudacoes[Math.floor(Math.random() * saudacoes.length)];
  const versiculo = versiculos[foco] || versiculos.paz;
  const fechamento = fechamentos[Math.floor(Math.random() * fechamentos.length)];

  // Montagem da oração personalizada
  const oracaoCustom = `*🙏 Oração Personalizada para ${nome}*

${saudacao},
venho diante de Ti com fé
intercedendo por *${nome}*.

${situacao}

Peço que derrames Tua graça,
Tua paz e Teu poder
sobre esta situação.

Como está escrito:
${versiculo}

${fechamento} e agradeço
antecipadamente pela resposta.

Em nome de Jesus Cristo,
Amém. 🙏`;

  return oracaoCustom;
}

/**
 * Obtém lista de categorias disponíveis
 * @returns {Array<string>} Array com nomes das categorias
 */
export function getCategorias() {
  return Object.keys(oracoesTemplates);
}

/**
 * Obtém informações sobre uma categoria específica
 * @param {string} categoria - Nome da categoria
 * @returns {Object|null} Informações da categoria ou null se não encontrada
 */
export function getInfoCategoria(categoria) {
  const categoriaLower = categoria.toLowerCase();
  const template = oracoesTemplates[categoriaLower];

  if (!template) {
    return null;
  }

  return {
    categoria: categoriaLower,
    titulo: template.titulo,
    totalVariantes: template.templates.length
  };
}

/**
 * Formata uma oração para envio via WhatsApp
 * Adiciona quebras de linha adequadas e formatação
 * @param {string} oracao - Texto da oração
 * @returns {string} Oração formatada para WhatsApp
 */
export function formatarParaWhatsApp(oracao) {
  // Garante espaçamento adequado entre parágrafos
  return oracao
    .split('\n\n')
    .map(paragrafo => paragrafo.trim())
    .filter(paragrafo => paragrafo.length > 0)
    .join('\n\n');
}

/**
 * Gera menu de categorias formatado para WhatsApp
 * @returns {string} Menu formatado
 */
export function gerarMenuCategorias() {
  const categorias = getCategorias();
  const emojis = {
    cura: '🩺',
    paz: '☮️',
    familia: '👨‍👩‍👧‍👦',
    trabalho: '💼',
    libertacao: '⛓️‍💥',
    gratidao: '🙌',
    protecao: '🛡️'
  };

  let menu = '*🙏 Categorias de Oração Disponíveis:*\n\n';

  categorias.forEach((cat, index) => {
    const emoji = emojis[cat] || '✨';
    const info = getInfoCategoria(cat);
    menu += `${emoji} *${index + 1}.* ${info.titulo}\n`;
  });

  menu += '\n\nDigite o número ou nome da categoria para receber uma oração personalizada.';

  return menu;
}

// Exportação default com todas as funções
export default {
  getOracao,
  generateCustomOracao,
  getCategorias,
  getInfoCategoria,
  formatarParaWhatsApp,
  gerarMenuCategorias
};
