/**
 * Exemplos de Uso do Módulo de Orações
 * Demonstra como integrar o sistema de orações no bot WhatsApp
 */

import {
  getOracao,
  generateCustomOracao,
  getCategorias,
  getInfoCategoria,
  formatarParaWhatsApp,
  gerarMenuCategorias
} from './oracoes.js';

console.log('='.repeat(60));
console.log('EXEMPLOS DE USO - Sistema de Orações');
console.log('='.repeat(60));

// Exemplo 1: Listar todas as categorias disponíveis
console.log('\n1. LISTAR CATEGORIAS DISPONÍVEIS\n');
const categorias = getCategorias();
console.log('Categorias:', categorias);

// Exemplo 2: Obter informações de uma categoria específica
console.log('\n2. INFORMAÇÕES DE UMA CATEGORIA\n');
const infoCura = getInfoCategoria('cura');
console.log('Info Cura:', infoCura);

// Exemplo 3: Gerar oração de cura completa
console.log('\n3. ORAÇÃO DE CURA - COMPLETA\n');
const oracaoCura = getOracao('cura', {
  nome: 'Maria Silva',
  situacao: 'uma enfermidade no coração',
  pedido: 'derrama Tua cura completa e restauração total'
});
console.log(oracaoCura);

// Exemplo 4: Oração de paz com dados mínimos
console.log('\n' + '='.repeat(60));
console.log('\n4. ORAÇÃO DE PAZ - DADOS MÍNIMOS\n');
const oracaoPaz = getOracao('paz', {
  nome: 'João Santos'
});
console.log(oracaoPaz);

// Exemplo 5: Oração de família - variante diferente
console.log('\n' + '='.repeat(60));
console.log('\n5. ORAÇÃO DE FAMÍLIA - VARIANTE 2\n');
const oracaoFamilia = getOracao('familia', {
  nome: 'Pedro Oliveira',
  situacao: 'conflitos familiares e falta de união',
  pedido: 'restaura os laços de amor e traz harmonia ao lar'
}, 1); // Variante 1 (segunda opção)
console.log(oracaoFamilia);

// Exemplo 6: Oração de trabalho
console.log('\n' + '='.repeat(60));
console.log('\n6. ORAÇÃO PELO TRABALHO\n');
const oracaoTrabalho = getOracao('trabalho', {
  nome: 'Ana Costa',
  situacao: 'busca por uma nova oportunidade de emprego',
  pedido: 'abre portas de oportunidades e concede favor'
});
console.log(oracaoTrabalho);

// Exemplo 7: Oração de libertação
console.log('\n' + '='.repeat(60));
console.log('\n7. ORAÇÃO DE LIBERTAÇÃO\n');
const oracaoLibertacao = getOracao('libertacao', {
  nome: 'Carlos Mendes',
  situacao: 'opressões e pensamentos negativos',
  pedido: 'liberta de toda corrente espiritual e mental'
});
console.log(oracaoLibertacao);

// Exemplo 8: Oração de gratidão
console.log('\n' + '='.repeat(60));
console.log('\n8. ORAÇÃO DE GRATIDÃO\n');
const oracaoGratidao = getOracao('gratidao', {
  nome: 'Lucia Ferreira',
  situacao: 'a bênção recebida de cura completa',
  pedido: 'recebe este louvor e gratidão sincera'
});
console.log(oracaoGratidao);

// Exemplo 9: Oração de proteção
console.log('\n' + '='.repeat(60));
console.log('\n9. ORAÇÃO DE PROTEÇÃO\n');
const oracaoProtecao = getOracao('protecao', {
  nome: 'Roberto Lima',
  situacao: 'viagens e deslocamentos diários para o trabalho',
  pedido: 'guarda cada passo e protege de todo perigo'
});
console.log(oracaoProtecao);

// Exemplo 10: Gerar oração personalizada única
console.log('\n' + '='.repeat(60));
console.log('\n10. ORAÇÃO PERSONALIZADA ÚNICA\n');
const oracaoCustom = generateCustomOracao(
  'Fernanda Alves',
  'está enfrentando um momento de grande ansiedade e incerteza sobre o futuro, sentindo-se sobrecarregada com as responsabilidades',
  'paz'
);
console.log(oracaoCustom);

// Exemplo 11: Oração personalizada com foco em cura
console.log('\n' + '='.repeat(60));
console.log('\n11. ORAÇÃO PERSONALIZADA - FOCO EM CURA\n');
const oracaoCustomCura = generateCustomOracao(
  'Gabriel Souza',
  'passando por tratamento médico e precisa de forças para continuar',
  'cura'
);
console.log(oracaoCustomCura);

// Exemplo 12: Menu de categorias para WhatsApp
console.log('\n' + '='.repeat(60));
console.log('\n12. MENU DE CATEGORIAS PARA WHATSAPP\n');
const menu = gerarMenuCategorias();
console.log(menu);

// Exemplo 13: Formatação para WhatsApp
console.log('\n' + '='.repeat(60));
console.log('\n13. FORMATAÇÃO PARA WHATSAPP\n');
const textoSemFormatacao = `
  Primeira linha com espaços



  Segunda linha

  Terceira linha
`;
const textoFormatado = formatarParaWhatsApp(textoSemFormatacao);
console.log('Antes da formatação:', JSON.stringify(textoSemFormatacao));
console.log('Depois da formatação:', JSON.stringify(textoFormatado));

// Exemplo 14: Fluxo completo de uso em bot
console.log('\n' + '='.repeat(60));
console.log('\n14. FLUXO COMPLETO DE USO EM BOT WHATSAPP\n');
console.log('Simulação de conversa:\n');

// Usuário pede oração
const mensagemUsuario = 'Preciso de uma oração pela minha família';
console.log(`Usuário: ${mensagemUsuario}\n`);

// Bot identifica categoria e solicita dados
console.log('Bot: Para personalizar sua oração, por favor me informe:\n');
console.log('1. Seu nome:');
console.log('2. Qual situação específica sua família está enfrentando?\n');

// Usuário responde
const dadosUsuario = {
  nome: 'Mariana',
  situacao: 'desentendimentos entre irmãos e falta de diálogo',
  pedido: 'restaura a união e traz paz ao nosso lar'
};

console.log(`Usuário: ${dadosUsuario.nome}`);
console.log(`Usuário: ${dadosUsuario.situacao}\n`);

// Bot gera e envia oração
const oracaoGerada = getOracao('familia', dadosUsuario);
const oracaoEnviar = formatarParaWhatsApp(oracaoGerada);
console.log('Bot:');
console.log(oracaoEnviar);

// Exemplo 15: Todas as categorias em sequência
console.log('\n' + '='.repeat(60));
console.log('\n15. VISÃO GERAL - TODAS AS CATEGORIAS\n');
categorias.forEach((cat, index) => {
  const info = getInfoCategoria(cat);
  console.log(`${index + 1}. ${info.titulo} (${cat})`);
  console.log(`   Variantes disponíveis: ${info.totalVariantes}`);
});

console.log('\n' + '='.repeat(60));
console.log('\nTODOS OS EXEMPLOS EXECUTADOS COM SUCESSO!');
console.log('='.repeat(60) + '\n');

// Exporta exemplo de integração com WhatsApp
export function exemplo_integracao_whatsapp(mensagem, nomeUsuario) {
  /**
   * Exemplo de função para integrar no handler de mensagens do bot
   *
   * @param {string} mensagem - Mensagem recebida do usuário
   * @param {string} nomeUsuario - Nome do usuário
   * @returns {string} Resposta do bot (oração ou menu)
   */

  // Detectar palavras-chave para categorias
  const keywordMap = {
    'cura': ['cura', 'curar', 'doença', 'doente', 'saúde', 'enfermidade'],
    'paz': ['paz', 'ansiedade', 'preocupação', 'tranquilidade', 'calma'],
    'familia': ['família', 'familia', 'filhos', 'pais', 'irmãos', 'casamento'],
    'trabalho': ['trabalho', 'emprego', 'desemprego', 'carreira', 'profissão'],
    'libertacao': ['libertação', 'libertacao', 'liberdade', 'opressão', 'vício'],
    'gratidao': ['gratidão', 'gratidao', 'agradecer', 'obrigado', 'graças'],
    'protecao': ['proteção', 'protecao', 'proteger', 'segurança', 'guarda']
  };

  // Detectar categoria
  let categoriaDetectada = null;
  const msgLower = mensagem.toLowerCase();

  for (const [categoria, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(keyword => msgLower.includes(keyword))) {
      categoriaDetectada = categoria;
      break;
    }
  }

  if (categoriaDetectada) {
    // Gera oração com dados básicos
    const oracao = getOracao(categoriaDetectada, {
      nome: nomeUsuario,
      situacao: 'este momento de necessidade',
      pedido: 'derrama Tua bênção e graça'
    });
    return formatarParaWhatsApp(oracao);
  } else {
    // Retorna menu de categorias
    return gerarMenuCategorias();
  }
}

// Teste da função de integração
console.log('\nTESTE DE INTEGRAÇÃO WHATSAPP:\n');
console.log('Mensagem: "Preciso de uma oração pela paz"\n');
const respostaBot = exemplo_integracao_whatsapp('Preciso de uma oração pela paz', 'Usuário Teste');
console.log(respostaBot);
