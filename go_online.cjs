const ngrok = require('ngrok');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');

// Configurações
const PORT = 3000;
const EVOLUTION_URL = 'https://evolution.escreve.ai';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'Jesus';

async function start() {
    console.log("🚀 Iniciando Operação 'Jesus Online' (via Ngrok)...");

    // 1. Iniciar o Webhook Server localmente
    console.log("🧠 Iniciando servidor cerebral...");
    const server = spawn('node', ['webhook_server.cjs'], { stdio: 'inherit' });

    server.on('error', (err) => {
        console.error('Falha ao iniciar servidor:', err);
    });

    // Esperar um pouco pro server subir
    await new Promise(r => setTimeout(r, 2000));

    // 2. Abrir Túnel (Ngrok)
    console.log("🌍 Abrindo portal para a internet (Ngrok)...");
    let url;
    try {
        await ngrok.kill().catch(() => { }); // Ignora erro no kill
        // Tenta conectar com nome único para evitar colisão
        url = await ngrok.connect({
            proto: 'http',
            addr: PORT,
            name: `jesus_${Date.now()}` // Nome único
        });
    } catch (e) {
        // Se falhar e for problema de configuração (tunnel exists), tentamos fallback
        if (e.body && e.body.msg === 'invalid tunnel configuration') {
            console.log("⚠️ Túnel já existe (ou conflito). Tentando recuperar URL existente...");
            try {
                // Tenta buscar da API local do Ngrok
                // Tenta porta 4040 e 4041 caso haja multiplas instancias
                let tunnels;
                try {
                    tunnels = await axios.get('http://127.0.0.1:4040/api/tunnels');
                } catch {
                    tunnels = await axios.get('http://127.0.0.1:4041/api/tunnels');
                }

                if (tunnels && tunnels.data && tunnels.data.tunnels) {
                    const t = tunnels.data.tunnels.find(t => t.proto === 'https');
                    if (t) {
                        url = t.public_url;
                        console.log("♻️ URL recuperada do túnel existente: " + url);
                    } else {
                        throw new Error("Túnel existe mas não achei URL HTTPS.");
                    }
                }
            } catch (ex) {
                console.error("❌ Falha crítica: Ngrok travado e não consigo pegar URL.", ex.message);
                // Não retorna, deixa cair no check de url
            }
        } else {
            console.error("Erro desconhecido no Ngrok:", e);
        }
    }

    if (!url) {
        console.error("❌ Não consegui obter nenhuma URL pública. Verifique se o Ngrok está autenticado.");
        console.log("Dica: rode `ngrok config add-authtoken SEU_TOKEN`");
        return;
    }

    console.log(`✅ Agente acessível em: ${url}`);
    fs.writeFileSync('online_status.json', JSON.stringify({ url: url, status: 'online' }));

    // 3. Configurar a Evolution API com a nova URL
    console.log("🔗 Conectando cérebro ao corpo (Configurando Webhook na API)...");

    try {
        const webhookUrl = `${url}/webhook`;
        console.log(`   Target: ${webhookUrl}`);

        const response = await axios.post(`${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`, {
            webhookUrl: webhookUrl,
            webhookByEvents: true,
            events: ["MESSAGES-UPSERT"]
        }, {
            headers: { 'apikey': API_KEY }
        });

        console.log("\n✨ SUCESSO! Jesus está ON-LINE e ouvindo.");
        console.log("   URL do Webhook: " + webhookUrl);
        console.log("   Mantenha este terminal aberto.");

    } catch (apiError) {
        console.error("\n⚠️ Aviso na configuração da API:");
        if (apiError.response) {
            console.error(`   Status: ${apiError.response.status}`);
            console.log(`\n   Verifique se o nome da instância é '${INSTANCE_NAME}' ou use o ID.`);
        } else {
            console.error("   Erro:", apiError.message);
        }
    }
}

start();
