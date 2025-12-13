#!/bin/bash

# Evolution API - Script de Configuração do Agente
# Autor: Antigravity
# Descrição: Automatiza a criação de uma instância e configuração de OpenAI/Typebot para Evolution API.

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # Sem Cor

echo -e "${BLUE}=== Configuração do Agente Evolution API ===${NC}"

# 1. Configuração - Pedir detalhes ao usuário
read -p "Digite a URL Base da Evolution API (ex: http://localhost:8080): " BASE_URL
# Remover barra final se existir
BASE_URL=${BASE_URL%/}

read -s -p "Digite a API Key Global: " API_KEY
echo ""
read -p "Digite o Nome da Instância (ex: meu-assistente): " INSTANCE_NAME

if [ -z "$BASE_URL" ] || [ -z "$API_KEY" ] || [ -z "$INSTANCE_NAME" ]; then
    echo -e "${RED}Erro: Todos os campos são obrigatórios.${NC}"
    exit 1
fi

# Função para fazer requisições autenticadas
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ "$method" == "GET" ]; then
        curl -s -X GET "$BASE_URL$endpoint" \
            -H "apikey: $API_KEY"
    elif [ "$method" == "POST" ]; then
        curl -s -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "apikey: $API_KEY" \
            -d "$data"
    fi
}

echo -e "\n${BLUE}--> Verificando Instância: $INSTANCE_NAME${NC}"

# 2. Verificar/Criar Instância
# Tentar buscar instância para ver se existe
RESPONSE=$(make_request "GET" "/instance/fetchInstances?instanceName=$INSTANCE_NAME")

# Verificação simples se a instância existe na resposta
if echo "$RESPONSE" | grep -q "$INSTANCE_NAME"; then
    echo -e "${GREEN}Instância '$INSTANCE_NAME' já existe.${NC}"
else
    echo -e "${BLUE}Instância não encontrada. Criando...${NC}"
    CREATE_DATA="{\"instanceName\": \"$INSTANCE_NAME\", \"qrcode\": true, \"integration\": \"WHATSAPP-BAILEYS\"}"
    CREATE_RES=$(make_request "POST" "/instance/create" "$CREATE_DATA")
    echo "Resposta da criação: $CREATE_RES"
fi

# 3. Status da Conexão
echo -e "\n${BLUE}--> Verificando Status da Conexão...${NC}"
STATUS_RES=$(make_request "GET" "/instance/connectionState/$INSTANCE_NAME")
echo "Status: $STATUS_RES"

if echo "$STATUS_RES" | grep -q "open"; then
    echo -e "${GREEN}Instância está CONECTADA!${NC}"
else
    echo -e "${RED}Instância NÃO está conectada.${NC}"
    read -p "Deseja exibir o QR Code agora? (s/n) " SHOW_QR
    if [ "$SHOW_QR" == "s" ]; then
        echo "Buscando QR Code..."
        make_request "GET" "/instance/connect/$INSTANCE_NAME"
        echo -e "\n${BLUE}Verifique os logs do servidor ou a resposta acima para o QR Code.${NC}"
        echo "Por favor, escaneie o QR Code e pressione Enter para continuar a configuração."
        read -p ""
    fi
fi

# 4. Configuração de Inteligência
echo -e "\n${BLUE}=== Configuração de Inteligência ===${NC}"
echo "Escolha seu motor de IA:"
echo "1) OpenAI (ChatGPT)"
echo "2) Typebot"
echo "3) Pular"
read -p "Seleção [1-3]: " AI_CHOICE

if [ "$AI_CHOICE" == "1" ]; then
    echo -e "\n${BLUE}--> Configurando OpenAI${NC}"
    read -s -p "Digite a OpenAI API Key (sk-...): " OPENAI_KEY
    echo ""
    read -p "Digite o Prompt do Sistema (ex: 'Você é um assistente útil'): " SYSTEM_PROMPT
    
    # Definir Credenciais
    CREDS_DATA="{\"apiKey\": \"$OPENAI_KEY\"}"
    CREDS_RES=$(make_request "POST" "/openai/creds/$INSTANCE_NAME" "$CREDS_DATA")
    echo "Credenciais definidas: $CREDS_RES"
    
    echo -e "${RED}IMPORTANTE: Se a API exigir 'openaiCredsId', você pode precisar copiá-lo da resposta acima.${NC}"
    read -p "Digite openaiCredsId (ou pressione Enter para tentar sem/auto): " CREDS_ID
    
    BOT_DATA="{\"enabled\": true, \"botType\": \"chatCompletion\", \"model\": \"gpt-4o\", \"openaiCredsId\": \"$CREDS_ID\", \"systemMessages\": [\"$SYSTEM_PROMPT\"], \"triggerType\": \"all\", \"listeningFromMe\": false}"
    
    CREATE_BOT_RES=$(make_request "POST" "/openai/create/$INSTANCE_NAME" "$BOT_DATA")
    echo "Bot configurado: $CREATE_BOT_RES"

elif [ "$AI_CHOICE" == "2" ]; then
    echo -e "\n${BLUE}--> Configurando Typebot${NC}"
    read -p "Digite a URL do Viewer do Typebot (ex: https://viewer.typebot.io): " TYPEBOT_URL
    read -p "Digite o Slug do Typebot (ID público): " TYPEBOT_SLUG
    
    BOT_DATA="{\"enabled\": true, \"url\": \"$TYPEBOT_URL\", \"typebot\": \"$TYPEBOT_SLUG\", \"triggerType\": \"all\", \"expire\": 20, \"delayMessage\": 1000}"
    
    CREATE_BOT_RES=$(make_request "POST" "/typebot/create/$INSTANCE_NAME" "$BOT_DATA")
    echo "Typebot configurado: $CREATE_BOT_RES"
fi

echo -e "\n${GREEN}=== Configuração Completa ===${NC}"
echo "Teste seu agente enviando uma mensagem para o número de WhatsApp conectado."
