import * as path from 'path';
import * as fs from 'fs';
import { google } from 'googleapis';



export const getAuthClient = async () => {

    const credentialsPath = path.join(process.cwd(), 'src/utils/auth/oauth_secret.json')
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))
    const {client_secret, client_id, redirect_uris} = credentials.installed || credentials.web

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

    const tokenPath = path.join(process.cwd(), 'src/utils/auth/token.json')
    if(!fs.existsSync(tokenPath)){
        throw new Error("Arquivo tokens.json não encontrado! Rode o setup_auth.ts primeiro.");
    }

    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'))
    oAuth2Client.setCredentials(token)

    return oAuth2Client



}