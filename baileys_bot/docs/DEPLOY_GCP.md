# ☁️ Guia de Deploy - Jesus Cristo Bot no Google Cloud

Este guia explica como hospedar seu bot no **Google Compute Engine (GCE)**. Esta é a opção mais robusta pois permite conexão persistente (WebSocket) necessária para o WhatsApp e custa muito pouco (ou nada, se usar o Free Tier e2-micro em regiões elegíveis).

## Pré-requisitos

1. Uma conta no [Google Cloud Platform](https://console.cloud.google.com/).
2. Um projeto criado e faturamento ativado.

---

## Opção 1: Via Google Cloud Shell (Recomendado - Mais Fácil)

O Cloud Shell é um terminal direto no seu navegador, já logado na sua conta.

1. Acesse o [Console do Google Cloud](https://console.cloud.google.com/).
2. Clique no ícone de terminal **(>_)** no canto superior direito ("Ativar o Cloud Shell").
3. Quando o terminal abrir, execute os passos abaixo:

### Passo 1: Criar a Máquina Virtual (VM)

Copie e cole este comando para criar uma máquina pequena (e2-micro) que roda Docker:

```bash
gcloud compute instances create jesus-bot-vm \
    --project=[SEU_ID_DO_PROJETO_AQUI] \
    --zone=us-central1-a \
    --machine-type=e2-micro \
    --image-family=cos-stable \
    --image-project=cos-cloud \
    --tags=http-server,https-server
```
*(Substitua `[SEU_ID_DO_PROJETO_AQUI]` pelo ID do seu projeto que aparece no topo da tela).*

### Passo 2: Acessar a VM

Ainda no Cloud Shell, conecte-se à máquina que acabou de criar:

```bash
gcloud compute ssh jesus-bot-vm --zone=us-central1-a
```

### Passo 3: Configurar o Bot na VM

Agora que você está "dentro" da máquina na nuvem:

1. **Crie a pasta do projeto:**
   ```bash
   mkdir jesus-bot
   cd jesus-bot
   ```

2. **Crie os arquivos necessários:**
   Você precisará criar 3 arquivos aqui. Use o editor `nano` ou copie e cole.

   **Arquivo 1: docker-compose.yml**
   ```bash
   nano docker-compose.yml
   # (Cole o conteúdo do arquivo docker-compose.yml que está no seu projeto local)
   # Aperte Ctrl+O, Enter para salvar e Ctrl+X para sair
   ```

   **Arquivo 2: .env**
   ```bash
   nano .env
   # (Cole o conteúdo do seu .env local. IMPORTANTE: Coloque sua GEMINI_API_KEY aqui)
   # Aperte Ctrl+O, Enter, Ctrl+X
   ```

   **Arquivo 3: Dockerfile**
   ```bash
   nano Dockerfile
   # (Cole o conteúdo do Dockerfile local)
   # Aperte Ctrl+O, Enter, Ctrl+X
   ```

   **Arquivo 4: Copiar o código fonte**
   *Nota: A maneira mais fácil de enviar todo o código é zipar seu projeto local e fazer upload, ou clonar de um repositório Git (GitHub/GitLab).*
   
   Se usar Git (Recomendado):
   ```bash
   git clone [SEU_REPOSITORIO] .
   ```

### Passo 4: Iniciar o Bot

```bash
# Constrói a imagem e inicia em segundo plano
docker-compose up -d --build
```

### Passo 5: Escanear o QR Code

Como o bot está rodando em "background", você precisa ver os logs para pegar o QR Code:

```bash
docker-compose logs -f jesus-bot
```

O QR Code aparecerá na tela. Escaneie com seu celular.
Para sair dos logs (sem desligar o bot), aperte `Ctrl+C`.

---

## Manutenção

- **Parar o bot:** `docker-compose down`
- **Ver se está rodando:** `docker ps`
- **Atualizar o código:**
  1. `git pull` (se usou git)
  2. `docker-compose up -d --build` (para recriar o container com código novo)

## Custos (Estimativa)

- **e2-micro** em `us-central1` (Iowa), `us-west1` (Oregon) ou `us-east1` (S. Carolina) faz parte do **Nível Gratuito** (Free Tier) do Google Cloud (sujeito a alterações do Google), permitindo rodar 1 instância 24/7 de graça (apenas custo de disco e rede, que são centavos).
