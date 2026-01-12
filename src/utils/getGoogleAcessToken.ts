import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import readline from 'readline';

const SCOPES = ['https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/gmail.send'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'src/utils/auth/oauth_secret.json');
const TOKEN_PATH = path.join(process.cwd(), 'src/utils/auth/token.json');

async function getAccessToken() {
  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const credentials = JSON.parse(content);
  
 
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline', 
    scope: SCOPES,
  });

  console.log('⚠️  Autorize este app visitando esta URL: \n\n', authUrl, '\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('📋 Cole o código obtido na página aqui: ', async (code) => {
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
      console.log('✅ Token armazenado com sucesso em:', TOKEN_PATH);
      console.log('Agora você pode rodar o seu Agente!');
    } catch (error) {
      console.error('Erro ao obter token:', error);
    }
    rl.close();
  });
}

getAccessToken();