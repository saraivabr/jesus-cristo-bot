#!/bin/bash

SERVER_IP="185.194.216.184"
USER="root"
REMOTE_DIR="/root/jesus_agent"

echo "🚀 Iniciando Deploy para $SERVER_IP..."

# 1. Configurar diretório remoto
echo "📂 Criando pasta remota..."
ssh $USER@$SERVER_IP "mkdir -p $REMOTE_DIR"

# 2. Enviar arquivos
echo "📤 Enviando Cérebro (webhook_server.cjs)..."
scp webhook_server.cjs $USER@$SERVER_IP:$REMOTE_DIR/webhook_server.js
# Enviando package.json simples para facilitar
echo '{"name":"jesus-agent","version":"1.0.0","main":"webhook_server.js","dependencies":{"axios":"^1.6.0","express":"^4.18.0","form-data":"^4.0.0"}}' > package.remote.json
scp package.remote.json $USER@$SERVER_IP:$REMOTE_DIR/package.json
rm package.remote.json

# 3. Instalação Remota
echo "🛠️ Configurando ambiente remoto (Node.js, PM2)..."
ssh $USER@$SERVER_IP << 'EOF'
    # Instalar Node 20 se não tiver (script padrão nodesource)
    if ! command -v node &> /dev/null; then
        echo "Instalando Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi

    cd /root/jesus_agent
    
    # Instalar deps
    echo "Instalando dependências..."
    npm install

    # Instalar PM2 global
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi

    # Parar anterior se existir e Iniciar
    pm2 stop jesus-agent 2>/dev/null || true
    pm2 delete jesus-agent 2>/dev/null || true
    pm2 start webhook_server.js --name jesus-agent
    pm2 save
    
    # Liberar porta 3000 (tentativa básica)
    ufw allow 3000 2>/dev/null || true
    iptables -I INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true

    echo "✅ Servidor rodando no IP!"
EOF

echo "🔗 Atualizando Evolution API..."
# Configurar a API daqui mesmo usando curl, já que temos a chave
API_KEY="429683C4C977415CAAFCCE10F7D57E11"
EVOLUTION_URL="https://evolution.escreve.ai"
INSTANCE="Jesus"
WEBHOOK_URL="http://$SERVER_IP:3000/webhook"

curl -X POST "$EVOLUTION_URL/webhook/set/$INSTANCE" \
-H "apikey: $API_KEY" \
-H "Content-Type: application/json" \
-d "{
    \"webhookUrl\": \"$WEBHOOK_URL\",
    \"webhookByEvents\": true,
    \"events\": [\"MESSAGES-UPSERT\"]
}"

echo ""
echo "✨ Deploy Concluído! O Agente Jesus está rodando no servidor $SERVER_IP."
