FROM node:20-slim

# Instalar dependências do sistema necessárias
# ffmpeg: para processamento de áudio
# python3/make/g++: para compilar dependências nativas do node se necessário
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Configurar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências do Node.js
RUN npm install --production

# Copiar o restante do código
COPY . .

# Criar diretórios para volumes persistentes (garantir permissões)
RUN mkdir -p auth_session data temp && \
    chmod 777 auth_session data temp

# Variáveis de ambiente padrão
ENV NODE_ENV=production

# Comando de inicialização
CMD ["npm", "start"]
