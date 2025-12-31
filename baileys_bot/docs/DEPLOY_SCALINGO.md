# Deploy no Scalingo - Jesus Pastoral Bot

## Pre-requisitos

1. Conta no Scalingo: https://scalingo.com
2. CLI do Scalingo instalado
3. Git configurado

## Passo 1: Criar a App no Scalingo

```bash
# Login no Scalingo
scalingo login

# Criar a aplicação
scalingo create jesus-pastoral-bot --region osc-fr1
```

## Passo 2: Adicionar Add-ons

```bash
# PostgreSQL (banco de dados principal)
scalingo --app jesus-pastoral-bot addons-add postgresql postgresql-starter-512

# MongoDB (sessão do WhatsApp)
scalingo --app jesus-pastoral-bot addons-add mongodb mongo-starter-256

# Redis (cache e rate limiting)
scalingo --app jesus-pastoral-bot addons-add redis redis-starter-64
```

## Passo 3: Configurar Variáveis de Ambiente

```bash
# API do Gemini (obrigatório)
scalingo --app jesus-pastoral-bot env-set GEMINI_API_KEY="sua-chave-api-aqui"

# Ambiente de produção
scalingo --app jesus-pastoral-bot env-set NODE_ENV="production"

# ID da sessão (opcional, default: jesus_bot_session)
scalingo --app jesus-pastoral-bot env-set SESSION_ID="jesus_bot_session"

# Debounce time em ms (opcional, default: 10000)
scalingo --app jesus-pastoral-bot env-set DEBOUNCE_TIME="10000"
```

## Passo 4: Deploy

### Opção A: Via Git

```bash
# Adicionar remote do Scalingo
git remote add scalingo git@ssh.osc-fr1.scalingo.com:jesus-pastoral-bot.git

# Fazer deploy
git push scalingo main
```

### Opção B: Via GitHub

1. Acesse o dashboard do Scalingo
2. Vá em "Deploy" > "GitHub"
3. Conecte seu repositório
4. Habilite auto-deploy (opcional)

## Passo 5: Primeira Conexão (QR Code)

```bash
# Ver logs em tempo real
scalingo --app jesus-pastoral-bot logs -f

# O QR Code aparecerá nos logs
# Escaneie com o WhatsApp
```

**Importante:** Você tem aproximadamente 60 segundos para escanear o QR Code antes dele expirar.

## Passo 6: Migrar Dados (Opcional)

Se você tem dados no SQLite local que quer migrar:

```bash
# Faça upload do arquivo SQLite para o container
scalingo --app jesus-pastoral-bot run bash

# Dentro do container, execute a migração
npm run migrate
```

## Arquitetura no Scalingo

```
┌─────────────────────────────────────────────────────┐
│                   SCALINGO                           │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│  │  Redis   │   │ MongoDB  │   │PostgreSQL│        │
│  │  (Cache) │   │ (Sessão) │   │  (Dados) │        │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘        │
│       │              │              │               │
│       └──────────────┼──────────────┘               │
│                      │                              │
│              ┌───────┴───────┐                      │
│              │   Node.js     │                      │
│              │  Jesus Bot    │                      │
│              └───────┬───────┘                      │
│                      │                              │
└──────────────────────┼──────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   WhatsApp     │
              │   Web API      │
              └────────────────┘
```

## Variáveis de Ambiente Automáticas

O Scalingo configura automaticamente:

| Variável | Descrição |
|----------|-----------|
| `SCALINGO_POSTGRESQL_URL` | URL do PostgreSQL |
| `SCALINGO_MONGO_URL` | URL do MongoDB |
| `SCALINGO_REDIS_URL` | URL do Redis |
| `PORT` | Porta do servidor |

## Comandos Úteis

```bash
# Ver logs
scalingo --app jesus-pastoral-bot logs -f

# Reiniciar
scalingo --app jesus-pastoral-bot restart

# Acessar shell
scalingo --app jesus-pastoral-bot run bash

# Ver variáveis de ambiente
scalingo --app jesus-pastoral-bot env

# Ver status dos add-ons
scalingo --app jesus-pastoral-bot addons

# Escalar (mais recursos)
scalingo --app jesus-pastoral-bot scale web:1:M
```

## Troubleshooting

### QR Code não aparece

```bash
# Limpar sessão e reiniciar
scalingo --app jesus-pastoral-bot run node -e "
const { clearSession } = await import('./sessionStore.js');
await clearSession('jesus_bot_session');
console.log('Sessão limpa!');
"
scalingo --app jesus-pastoral-bot restart
```

### Bot não responde

1. Verifique os logs: `scalingo --app jesus-pastoral-bot logs -f`
2. Verifique se o WhatsApp está conectado
3. Verifique se a API do Gemini está funcionando

### Erro de conexão com banco

```bash
# Verificar status dos add-ons
scalingo --app jesus-pastoral-bot addons

# Reiniciar add-on (se necessário)
scalingo --app jesus-pastoral-bot addons-restart postgresql
```

## Custos Estimados

| Add-on | Plano | Custo/mês |
|--------|-------|-----------|
| PostgreSQL | starter-512 | ~$7 |
| MongoDB | starter-256 | ~$15 |
| Redis | starter-64 | ~$5 |
| Container | S (512MB) | ~$7 |
| **Total** | | **~$34/mês** |

## Dicas de Economia

1. Use o plano Sandbox para testes (gratuito, mas limitado)
2. Redis é opcional - o bot funciona sem cache
3. MongoDB é essencial para manter a sessão persistente

## Suporte

- Documentação Scalingo: https://doc.scalingo.com
- Issues do projeto: https://github.com/seu-usuario/jesus-bot/issues
