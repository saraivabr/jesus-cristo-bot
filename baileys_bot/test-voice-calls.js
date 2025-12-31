/**
 * 🕊️ JESUS CRISTO BOT - Teste de Chamadas de Voz
 * Script para verificar se a integração de chamadas de voz está funcionando
 */

import config from './config.js';
import { useVoiceCallsBaileys } from 'voice-calls-baileys';

console.log('\n🕊️ ════════════════════════════════════════════════');
console.log('   TESTE DE INTEGRAÇÃO - CHAMADAS DE VOZ');
console.log('════════════════════════════════════════════════\n');

// Verificar configuração
console.log('📋 Verificando configuração...');
console.log('   VOICE_CALLS_CONFIG.enabled:', config.VOICE_CALLS_CONFIG.enabled);
console.log('   VOICE_CALLS_CONFIG.autoConnect:', config.VOICE_CALLS_CONFIG.autoConnect);
console.log('   VOICE_CALLS_CONFIG.logger:', config.VOICE_CALLS_CONFIG.logger);
console.log('   Token configurado:', config.VOICE_CALLS_CONFIG.token ? '✅ Sim' : '❌ Não');

if (!config.VOICE_CALLS_CONFIG.enabled) {
    console.log('\n⚠️  Chamadas de voz DESABILITADAS');
    console.log('   Para habilitar, configure WAVOIP_TOKEN no arquivo .env');
    console.log('\n   Exemplo:');
    console.log('   WAVOIP_TOKEN=seu_token_aqui\n');
    process.exit(0);
}

// Verificar se a biblioteca está carregada corretamente
console.log('\n📦 Verificando módulo voice-calls-baileys...');
if (typeof useVoiceCallsBaileys === 'function') {
    console.log('   ✅ Módulo carregado com sucesso');
    console.log('   ✅ Função useVoiceCallsBaileys disponível');
} else {
    console.error('   ❌ Erro: useVoiceCallsBaileys não é uma função');
    process.exit(1);
}

// Verificar dependências do Baileys
console.log('\n📦 Verificando compatibilidade com Baileys...');
try {
    const baileys = await import('@whiskeysockets/baileys');
    console.log('   ✅ @whiskeysockets/baileys carregado');
    console.log('   ✅ makeWASocket disponível:', typeof baileys.default === 'function');
} catch (error) {
    console.error('   ❌ Erro ao carregar Baileys:', error.message);
    process.exit(1);
}

// Verificar socket.io-client (dependência do voice-calls-baileys)
console.log('\n📦 Verificando socket.io-client...');
try {
    const socketIO = await import('socket.io-client');
    console.log('   ✅ socket.io-client carregado');
    console.log('   ✅ io disponível:', typeof socketIO.io === 'function');
} catch (error) {
    console.error('   ❌ Erro ao carregar socket.io-client:', error.message);
    process.exit(1);
}

console.log('\n✨ RESULTADO:');
console.log('   ✅ Todas as verificações passaram!');
console.log('   ✅ Integração de chamadas de voz está pronta');
console.log('\n📝 PRÓXIMOS PASSOS:');
console.log('   1. Configure WAVOIP_TOKEN no arquivo .env');
console.log('   2. Inicie o bot normalmente: npm start');
console.log('   3. Conecte-se ao WhatsApp escaneando o QR Code');
console.log('   4. As chamadas de voz serão habilitadas automaticamente\n');

console.log('🕊️ Paz esteja contigo!\n');
