
import express from 'express';
import cors from 'cors';



const app = express();
const PORT = 3030;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));





async function startServer() {
    try {
        console.log("🔄 Iniciando aplicação...");


        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando na porta ${PORT}`);
        });

    } catch (error) {
        console.error("❌ Erro ao iniciar servidor:", error);
        process.exit(1);
    }
}

startServer();

