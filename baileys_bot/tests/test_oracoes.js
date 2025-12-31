/**
 * Testes para o módulo de orações
 * Execute com: node tests/test_oracoes.js
 */

import {
  getOracao,
  generateCustomOracao,
  getCategorias,
  getInfoCategoria,
  formatarParaWhatsApp,
  gerarMenuCategorias
} from '../prompts/oracoes.js';

// Cores para output no terminal
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

/**
 * Função auxiliar para testar
 */
function test(description, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`${GREEN}✓${RESET} ${description}`);
  } catch (error) {
    testsFailed++;
    console.log(`${RED}✗${RESET} ${description}`);
    console.log(`  ${RED}Erro: ${error.message}${RESET}`);
  }
}

/**
 * Função de asserção
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Início dos testes
console.log(`${BLUE}========================================${RESET}`);
console.log(`${BLUE}Testes do Módulo de Orações${RESET}`);
console.log(`${BLUE}========================================${RESET}\n`);

// Testes: getCategorias()
console.log(`${YELLOW}Testando getCategorias()${RESET}`);
test('deve retornar array de categorias', () => {
  const categorias = getCategorias();
  assert(Array.isArray(categorias), 'Deve retornar um array');
  assert(categorias.length > 0, 'Array não deve estar vazio');
});

test('deve incluir categoria "cura"', () => {
  const categorias = getCategorias();
  assert(categorias.includes('cura'), 'Deve incluir categoria cura');
});

test('deve incluir todas as 7 categorias', () => {
  const categorias = getCategorias();
  assert(categorias.length === 7, `Deve ter 7 categorias, tem ${categorias.length}`);
  const expected = ['cura', 'paz', 'familia', 'trabalho', 'libertacao', 'gratidao', 'protecao'];
  expected.forEach(cat => {
    assert(categorias.includes(cat), `Deve incluir categoria ${cat}`);
  });
});

// Testes: getInfoCategoria()
console.log(`\n${YELLOW}Testando getInfoCategoria()${RESET}`);
test('deve retornar informações da categoria "cura"', () => {
  const info = getInfoCategoria('cura');
  assert(info !== null, 'Deve retornar informações');
  assert(info.categoria === 'cura', 'Categoria deve ser "cura"');
  assert(info.titulo === 'Oração pela Cura', 'Título deve estar correto');
  assert(info.totalVariantes >= 1, 'Deve ter pelo menos 1 variante');
});

test('deve retornar null para categoria inválida', () => {
  const info = getInfoCategoria('naoexiste');
  assert(info === null, 'Deve retornar null para categoria inválida');
});

test('deve ser case-insensitive', () => {
  const info1 = getInfoCategoria('CURA');
  const info2 = getInfoCategoria('Cura');
  const info3 = getInfoCategoria('cura');
  assert(info1 !== null && info2 !== null && info3 !== null, 'Deve aceitar diferentes casos');
});

// Testes: getOracao()
console.log(`\n${YELLOW}Testando getOracao()${RESET}`);
test('deve retornar oração válida com dados completos', () => {
  const oracao = getOracao('cura', {
    nome: 'João',
    situacao: 'uma enfermidade',
    pedido: 'cura completa'
  });
  assert(oracao !== null, 'Deve retornar uma oração');
  assert(typeof oracao === 'string', 'Deve retornar string');
  assert(oracao.includes('João'), 'Deve incluir o nome fornecido');
  assert(oracao.includes('enfermidade'), 'Deve incluir a situação');
  assert(oracao.includes('cura completa'), 'Deve incluir o pedido');
});

test('deve substituir todos os placeholders {nome}', () => {
  const oracao = getOracao('paz', {
    nome: 'Maria',
    situacao: 'ansiedade',
    pedido: 'paz interior'
  });
  assert(!oracao.includes('{nome}'), 'Não deve conter placeholder {nome}');
  assert(!oracao.includes('{situacao}'), 'Não deve conter placeholder {situacao}');
  assert(!oracao.includes('{pedido}'), 'Não deve conter placeholder {pedido}');
});

test('deve usar valores padrão quando campos opcionais faltam', () => {
  const oracao = getOracao('paz', { nome: 'Pedro' });
  assert(oracao !== null, 'Deve retornar oração mesmo sem todos os campos');
  assert(oracao.includes('Pedro'), 'Deve incluir o nome');
});

test('deve retornar null para categoria inválida', () => {
  const oracao = getOracao('invalida', { nome: 'João' });
  assert(oracao === null, 'Deve retornar null para categoria inválida');
});

test('deve retornar null sem nome', () => {
  const oracao = getOracao('cura', { situacao: 'teste' });
  assert(oracao === null, 'Deve retornar null sem nome');
});

test('deve aceitar variante diferente', () => {
  const oracao1 = getOracao('paz', { nome: 'Ana' }, 0);
  const oracao2 = getOracao('paz', { nome: 'Ana' }, 1);
  assert(oracao1 !== oracao2, 'Variantes diferentes devem gerar orações diferentes');
});

// Testes: generateCustomOracao()
console.log(`\n${YELLOW}Testando generateCustomOracao()${RESET}`);
test('deve gerar oração personalizada válida', () => {
  const oracao = generateCustomOracao('Carlos', 'passando por dificuldades financeiras');
  assert(typeof oracao === 'string', 'Deve retornar string');
  assert(oracao.includes('Carlos'), 'Deve incluir o nome');
  assert(oracao.includes('dificuldades financeiras'), 'Deve incluir a situação');
  assert(oracao.includes('Amém'), 'Deve incluir Amém');
});

test('deve aceitar foco personalizado', () => {
  const oracao = generateCustomOracao('José', 'enfrentando desafios', 'cura');
  assert(oracao.includes('José'), 'Deve incluir o nome');
  assert(oracao.length > 100, 'Deve gerar oração substancial');
});

test('deve usar foco padrão "paz" quando não especificado', () => {
  const oracao = generateCustomOracao('Lucas', 'momento difícil');
  assert(oracao.includes('Lucas'), 'Deve incluir o nome');
});

// Testes: formatarParaWhatsApp()
console.log(`\n${YELLOW}Testando formatarParaWhatsApp()${RESET}`);
test('deve manter formatação básica', () => {
  const texto = 'Linha 1\n\nLinha 2\n\nLinha 3';
  const formatado = formatarParaWhatsApp(texto);
  assert(formatado.includes('\n\n'), 'Deve manter quebras duplas de linha');
});

test('deve remover espaços em branco desnecessários', () => {
  const texto = '  Linha 1  \n\n  Linha 2  ';
  const formatado = formatarParaWhatsApp(texto);
  assert(!formatado.startsWith(' '), 'Não deve começar com espaço');
  assert(!formatado.endsWith(' '), 'Não deve terminar com espaço');
});

test('deve filtrar parágrafos vazios', () => {
  const texto = 'Linha 1\n\n\n\nLinha 2';
  const formatado = formatarParaWhatsApp(texto);
  assert(!formatado.includes('\n\n\n\n'), 'Não deve ter múltiplas quebras consecutivas');
});

// Testes: gerarMenuCategorias()
console.log(`\n${YELLOW}Testando gerarMenuCategorias()${RESET}`);
test('deve gerar menu formatado', () => {
  const menu = gerarMenuCategorias();
  assert(typeof menu === 'string', 'Deve retornar string');
  assert(menu.includes('Categorias de Oração'), 'Deve incluir título');
  assert(menu.includes('1.'), 'Deve incluir numeração');
});

test('deve incluir todas as categorias no menu', () => {
  const menu = gerarMenuCategorias();
  const categorias = getCategorias();
  categorias.forEach(cat => {
    const info = getInfoCategoria(cat);
    // Verifica se o título da categoria está no menu (case-insensitive)
    assert(
      menu.toLowerCase().includes(info.titulo.toLowerCase()),
      `Menu deve incluir ${info.titulo}`
    );
  });
});

// Testes de integração
console.log(`\n${YELLOW}Testes de Integração${RESET}`);
test('fluxo completo: categoria -> oração -> formatação', () => {
  const categorias = getCategorias();
  assert(categorias.length > 0, 'Deve ter categorias');

  const categoria = categorias[0];
  const oracao = getOracao(categoria, {
    nome: 'Teste',
    situacao: 'teste de integração',
    pedido: 'validação do sistema'
  });
  assert(oracao !== null, 'Deve gerar oração');

  const formatada = formatarParaWhatsApp(oracao);
  assert(formatada.length > 0, 'Deve formatar oração');
  assert(formatada.includes('Teste'), 'Deve manter conteúdo após formatação');
});

test('geração de múltiplas orações para todas as categorias', () => {
  const categorias = getCategorias();
  categorias.forEach(cat => {
    const oracao = getOracao(cat, {
      nome: 'Fulano',
      situacao: 'necessidade específica',
      pedido: 'ajuda divina'
    });
    assert(oracao !== null, `Deve gerar oração para categoria ${cat}`);
    assert(oracao.includes('Fulano'), `Oração de ${cat} deve incluir nome`);
  });
});

// Resumo dos testes
console.log(`\n${BLUE}========================================${RESET}`);
console.log(`${BLUE}Resumo dos Testes${RESET}`);
console.log(`${BLUE}========================================${RESET}`);
console.log(`Total de testes: ${testsRun}`);
console.log(`${GREEN}Passou: ${testsPassed}${RESET}`);
console.log(`${RED}Falhou: ${testsFailed}${RESET}`);

if (testsFailed === 0) {
  console.log(`\n${GREEN}✓ Todos os testes passaram!${RESET}\n`);
  process.exit(0);
} else {
  console.log(`\n${RED}✗ Alguns testes falharam${RESET}\n`);
  process.exit(1);
}
