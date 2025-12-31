# 📞 Implementação de Chamadas de Voz com IA - Jesus Cristo Bot

## 🎯 Resumo da Implementação

Esta implementação adiciona funcionalidade completa de chamadas de voz ao Jesus Cristo Bot, permitindo que usuários conversem naturalmente via WhatsApp com respostas inteligentes geradas por IA.

## 📋 Arquivos Modificados/Criados

### Novos Arquivos
- `baileys_bot/voiceCallHandler.js` - Handler principal para chamadas de voz com IA
- `baileys_bot/test-voice-calls.js` - Script de teste para validar a integração

### Arquivos Modificados
- `baileys_bot/package.json` - Adicionada dependência `voice-calls-baileys`
- `baileys_bot/config.js` - Configurações para Wavoip e chamadas de voz
- `baileys_bot/.env.example` - Variável WAVOIP_TOKEN adicionada
- `baileys_bot/database.js` - Tabela `call_logs` e funções relacionadas
- `baileys_bot/index.js` - Eventos de chamada e handler
- `baileys_bot/indexScalingo.js` - Eventos de chamada e handler (versão produção)
- `README.md` - Documentação completa da funcionalidade

## 🔧 Dependências Adicionadas

```json
{
  "voice-calls-baileys": "^1.0.7"
}
```

**Dependências externas necessárias:**
- `edge-tts` (Python): `pip install edge-tts`

## ⚙️ Configuração Necessária

### 1. Variáveis de Ambiente

Adicione ao arquivo `baileys_bot/.env`:

```bash
# Token Wavoip para chamadas de voz
WAVOIP_TOKEN=seu_token_wavoip_aqui

# Chave API do Gemini (já existente)
GEMINI_API_KEY=sua_chave_gemini
```

### 2. Instalar edge-tts

```bash
pip install edge-tts
```

### 3. Obter Token Wavoip

1. Acesse https://wavoip.com
2. Crie uma conta
3. Gere seu token de API
4. Configure no `.env`

## 🏗️ Arquitetura

### Fluxo de Funcionamento

```
┌─────────────────┐
│  Usuário Liga   │
│   via WhatsApp  │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────┐
│  Evento 'call' detectado pelo Baileys   │
│  Status: offer, accept, reject, timeout │
└────────┬────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│  handleVoiceCall() processa o evento    │
│  - Cria sessão de chamada               │
│  - Inicializa Gemini AI                 │
└────────┬────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│  Durante a chamada (loop):              │
│  1. Áudio recebido → Buffer             │
│  2. Transcrição (Gemini AI)             │
│  3. Processamento contextual (Gemini)   │
│  4. Síntese de voz (edge-tts)           │
│  5. Áudio enviado ao usuário            │
└────────┬────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│  Fim da chamada:                        │
│  - Salva log no banco de dados          │
│  - Limpa sessão                         │
└─────────────────────────────────────────┘
```

### Componentes Principais

#### 1. voiceCallHandler.js

**Classe CallSession:**
- Gerencia uma sessão de chamada ativa
- Mantém histórico da conversa
- Controla interação com Gemini AI

**Funções principais:**
- `startCall()` - Inicia nova chamada
- `processCallAudio()` - Processa áudio recebido
- `endCall()` - Encerra chamada e salva log
- `transcribeAudio()` - Transcreve áudio com Gemini
- `generateAIResponse()` - Gera resposta com IA
- `synthesizeSpeech()` - Converte texto em áudio

#### 2. Integração no Bot

**index.js / indexScalingo.js:**
```javascript
// Event listener para chamadas
if (events['call']) {
    const calls = events['call'];
    for (const call of calls) {
        await handleVoiceCall(call);
    }
}

// Handler de chamadas
async function handleVoiceCall(call) {
    const { from, id, status } = call;
    switch (status) {
        case 'offer':
            await voiceCallHandler.startCall(id, from);
            break;
        case 'timeout':
        case 'reject':
            await voiceCallHandler.endCall(id);
            break;
    }
}
```

#### 3. Banco de Dados

**Tabela call_logs:**
```sql
CREATE TABLE call_logs (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER,
    call_id TEXT,
    duration INTEGER,
    message_count INTEGER,
    conversation_json TEXT,
    timestamp TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
)
```

## 🔒 Segurança

### Medidas Implementadas

1. **Prevenção de Command Injection**
   - Uso de `execFile()` ao invés de `exec()`
   - Texto escrito em arquivo temporário
   - Sem interpolação direta de strings em comandos

2. **Validação de Paths**
   - EDGE_TTS_PATH validado contra whitelist
   - Apenas paths seguros permitidos

3. **Geração de IDs Únicos**
   - Uso de `crypto.randomUUID()` 
   - Previne colisões de arquivos temporários

4. **Sanitização de Inputs**
   - Função `cleanTextForTTS()` remove markdown e caracteres especiais
   - Previne problemas com TTS

5. **Tratamento de Erros**
   - Try-catch em todas operações críticas
   - Fallbacks apropriados
   - Logs detalhados de erros

## 📊 Monitoramento e Logs

### Logs Salvos no Banco

Cada chamada gera um registro com:
- ID da chamada
- Usuário (JID)
- Duração em segundos
- Número de mensagens trocadas
- Histórico completo da conversa (JSON)
- Timestamp de início

### Logs de Console

Durante a execução:
```
📞 [VoiceCall] Evento de chamada: offer
   De: 5511999999999@s.whatsapp.net
   ID: 123ABC...
   📥 Chamada recebida - iniciando sessão AI
✅ Chamadas de voz habilitadas via Wavoip
[VoiceCall] Processando áudio recebido (4096 bytes)
[VoiceCall] Transcrito: "Olá, preciso de ajuda..."
[VoiceCall] Resposta AI: "Paz esteja contigo..."
[VoiceCall] Sintetizando fala: "Paz esteja contigo..."
```

## 🧪 Testes

### Teste Manual

1. Execute o script de teste:
```bash
cd baileys_bot
node test-voice-calls.js
```

2. Verificações realizadas:
   - Configuração VOICE_CALLS_CONFIG
   - Módulo voice-calls-baileys carregado
   - Compatibilidade com Baileys
   - socket.io-client disponível

### Teste de Integração

1. Inicie o bot: `npm start`
2. Ligue para o bot via WhatsApp
3. Fale algo
4. Verifique se recebe resposta em áudio
5. Verifique logs no console
6. Verifique registro no banco de dados

## 📈 Métricas e Performance

### Limitações Configuradas

- **MAX_RESPONSE_LENGTH**: 600 caracteres (~200 palavras)
  - Evita respostas muito longas que cansam o ouvinte
  
- **TTS Timeout**: 30 segundos
  - Tempo máximo para síntese de voz

- **Gemini Timeout**: Padrão da API
  - Transcrição e geração de resposta

### Performance Esperada

- Transcrição: ~2-3 segundos
- Geração de resposta: ~1-2 segundos
- Síntese de voz: ~1-3 segundos (depende do tamanho)
- **Total por interação**: ~5-10 segundos

## 🚀 Melhorias Futuras

### Possíveis Implementações

1. **Cache de Áudios Comuns**
   - Respostas frequentes pré-sintetizadas
   - Reduz latência

2. **Streaming de Áudio**
   - Enviar áudio enquanto está sendo sintetizado
   - Experiência mais fluida

3. **Detecção de Emoção**
   - Análise do tom de voz do usuário
   - Respostas adaptadas ao estado emocional

4. **Múltiplas Vozes**
   - Vozes diferentes para contextos diferentes
   - Masculina/feminina configurável

5. **Suporte a Chamadas em Grupo**
   - Moderar conversas em chamadas de grupo
   - Identificar quem está falando

6. **Análise de Sentimento**
   - Detectar urgência/crise em tempo real
   - Escalar para humano se necessário

## 🎓 Aprendizados e Boas Práticas

### Lições da Implementação

1. **Segurança em Primeiro Lugar**
   - Sempre use `execFile` ao invés de `exec`
   - Valide todos os inputs externos
   - Use UUIDs criptograficamente seguros

2. **Modularização**
   - Separar lógica de chamadas em módulo próprio
   - Facilita testes e manutenção

3. **Tratamento de Erros**
   - Não deixe o bot crashar por erro em chamada
   - Sempre tenha fallbacks

4. **Documentação**
   - Documente configurações necessárias
   - Inclua exemplos de uso

5. **Performance**
   - Limite tamanho de respostas
   - Use timeouts apropriados
   - Limpe recursos temporários

## 📞 Suporte

Para problemas com:

- **voice-calls-baileys**: https://github.com/wavoip/voice-calls-baileys
- **Wavoip**: https://wavoip.com/support
- **edge-tts**: https://github.com/rany2/edge-tts
- **Gemini AI**: https://ai.google.dev/docs

## 📄 Licença

Esta implementação segue a mesma licença do projeto principal (MIT).

---

**Desenvolvido com 🕊️ para o Jesus Cristo Bot**

*"E o Verbo se fez carne e habitou entre nós..."*
