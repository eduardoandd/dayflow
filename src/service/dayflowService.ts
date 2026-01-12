import { createAgent, tool } from 'langchain'
import { fastModel } from '../utils/models'
import { z } from 'zod'
import { content } from 'pdfkit/js/page'
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { getAuthClient } from '../utils/google0auth2';
import { google } from 'googleapis';

// Função auxiliar melhorada para codificação e HTML
const createEmailBody = (to: string[], subject: string, htmlBody: string, cc: string[] = []) => {
    // Codifica o Assunto para aceitar acentos (Padrão RFC 2047)
    const encodedSubject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

    const str = [
        `To: ${to.join(', ')}`,
        cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
        "Content-Type: text/html; charset=utf-8",
        "MIME-Version: 1.0",
        `Subject: ${encodedSubject}`,
        "",
        htmlBody 
    ].filter(Boolean).join("\n");

    // Codifica tudo para Base64URL (exigência do Gmail API)
    return Buffer.from(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
}

const generateHtmlTemplate = (message: string, meetingLink?: string) => {
    return `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #4285F4; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">Agendamento Confirmado</h2>
        </div>
        
        <div style="padding: 30px; background-color: #ffffff;">
            <p style="font-size: 16px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
            
            ${meetingLink ? `
            <div style="margin-top: 30px; text-align: center;">
                <a href="${meetingLink}" style="background-color: #34A853; color: white; padding: 14px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Entrar na Reunião
                </a>
                <p style="font-size: 12px; color: #888; margin-top: 10px;">Ou copie o link: <br> <a href="${meetingLink}" style="color: #4285F4;">${meetingLink}</a></p>
            </div>
            ` : ''}
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            <p>Este e-mail foi enviado automaticamente pelo seu Assistente Pessoal de IA.</p>
        </div>
    </div>
    `;
}


export const dayflowService = async (pedido: string) => {

    const CALENDAR_ID = 'eduardo.andrade.dev@gmail.com'



    // ferramentas que exigem entradas estruturadas e chama api do google agenda

    const createCalendarEvent = tool(
        async ({ title, startTime, endTime, attendees, location }: any) => {

            try {
                console.log("🛠️ Tentando criar evento no Google agenda...")
                const auth = await getAuthClient()

                const calendar = google.calendar({version: 'v3', auth})

                const attendeesFormatted = attendees.map((email:string) => ({email}))

                const response = await calendar.events.insert({
                    calendarId: CALENDAR_ID,
                    requestBody: {
                        summary: title,
                        location: location,
                        description: 'Agendado via IA',
                        start: {
                            dateTime: startTime,
                            timeZone: 'America/Sao_Paulo'
                        },
                        end: {
                            dateTime: endTime,
                            timeZone: 'America/Sao_Paulo'
                        },
                        attendees: attendeesFormatted
                    }
                })
                return `Sucesso Evento criado. Link: ${response.data.htmlLink}`

            } catch (error:any) {
                console.error("❌ Erro no Google Calendar:", error);

                return `Falha ao criar evento: ${error.message}`
            }
            
        },
        {
            name: "create_calendar_event",
            description: "Cria um evento no calendário. Requer o formato exato de data e hora ISO.",
            schema: z.object({
                title: z.string(),
                startTime: z.string().describe("Formato ISO: '2024-01-15T14:00:00'"),
                endTime: z.string().describe("Formato ISO: '2024-01-15T14:00:00'"),
                attendees: z.array(z.string()).describe("Endereço de email"),
                location: z.string().optional().default('')
            })

        }

    )

    const getAvailableTimeSlots = tool(
        async ({ attendees, date, startTime, endTime }: any) => {
            try {
                const auth = await getAuthClient();
                const calendar = google.calendar({ version: 'v3', auth });

                const start = startTime ? startTime : "08:00:00";
                const end = endTime ? endTime : "18:00:00";

                const timeMin = new Date(`${date}T${start}-03:00`).toISOString();
                const timeMax = new Date(`${date}T${end}-03:00`).toISOString();

                const items = [{ id: CALENDAR_ID }, ...attendees.map((email: string) => ({ id: email }))];

                const response = await calendar.freebusy.query({
                    requestBody: {
                        timeMin,
                        timeMax,
                        timeZone: 'America/Sao_Paulo',
                        items: items
                    }
                });

                const buySlots = response.data.calendars;
                return JSON.stringify(buySlots);

            } catch (error: any) {
                return `Erro ao consultar agenda: ${error.message}`;
            }
        },
        {
            name: "get_available_time_slots",
            description: "Verifique a disponibilidade de agenda dos participantes em uma data e intervalo de tempo específicos",
            schema: z.object({
                attendees: z.array(z.string()),
                date: z.string().describe("Formato ISO: '2024-01-15'"),
                startTime: z.string().optional().describe("Formato 'HH:mm:ss'. Ex: '09:00:00'"),
                endTime: z.string().optional().describe("Formato 'HH:mm:ss'. Ex: '11:00:00'"),
                durationMinutes: z.number().optional()
            })
        }
    )

    const sendEmail = tool(
        async({to, subject, body,cc, meetingLink}:any) => {
            
            try {
                console.log(`📧 Preparando envio de e-mail para: ${to.join(', ')}`)

                const auth = await getAuthClient()
                const gmail = google.gmail({version: 'v1', auth})

                const finalHtmlBody = generateHtmlTemplate(body, meetingLink)

                // corpo codificado
                const rawMessage = createEmailBody(to, subject, finalHtmlBody, cc);

                const response = await gmail.users.messages.send({
                    userId: 'me',
                    requestBody:{
                        raw:rawMessage
                    }
                })
                console.log("✅ Email enviado com sucesso!");

                return `Email enviado com sucesso para ${to.join(", ")}. ID da mensagem: ${response.data.id}`

                
            } catch (error:any) {
                console.error("❌ Erro ao enviar email:", error);
                return `Falha ao enviar email: ${error.message}`;
                
            }

        },
        {
            name:"send_email",
            description:"Envia um email via API. Requer endereço formatado corretamente.",
            schema:z.object({
                to:z.array(z.string()).describe("Lista de endereços de e-mail dos destinatários."),
                subject: z.string().describe("Assunto do e-mail"),
                body: z.string().describe("Corpo da mensagem (pode ser texto simples ou html."),
                cc: z.array(z.string()).optional().default([]),
                meetingLink: z.string().optional().describe("URL da reunião (Google Meet/Zoom) se houver")
                
            })
        }
    )


    // Agentes especealizados para cada função.
    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const calendarAgent = createAgent({

        model: fastModel,
        tools: [createCalendarEvent, getAvailableTimeSlots],
        systemPrompt: `

            Você é um assistente de agendamento de calendário.            
            Analise solicitações de agendamento em linguagem natural
            (por exemplo, 'próxima terça-feira as 14h')
            e as converta para os formatos de data e hora ISO adequados.

            Use 'get_available_time_slots' para verificar a disponibilidade quando necessário.
            Use 'create_calendar_event' para agendar eventos.

            Sempre confirme o que foi agendado em sua resposta final.
            Informações importantes: HOJE É ${today}
        `.trim()

    })

    const emailAgent = createAgent({
        model:fastModel,
        tools:[sendEmail],
        systemPrompt: `
            Você é um assistente de comunicação profissional.
            
            Ao enviar e-mails sobre reuniões:
            1. Seja cordial e breve no 'body'.
            2. Se você tiver acesso a um link de reunião (Google Meet, Zoom, etc) vindo do contexto anterior,
               NÃO coloque o link solto no texto do corpo.
               Em vez disso, passe-o no argumento 'meetingLink' da ferramenta send_email.
            
            Sempre confirme o envio na resposta final.
        `.trim()
    })


    // encapsulando agente como uma ferramenta

    const scheduleEvent = tool(
        async ({ request }: any) => {

            const result = await calendarAgent.invoke({
                messages: [{ role: "user", content: request }]
            })

            const lastMessage = result.messages[result.messages.length - 1]
            return lastMessage.text
        },
        {
            name: "schedule_event",
            description: `
                Agende eventos na agenda usando linguagem natural.
                Use esta opção quando o usuário quiser criar, modificar ou verificar compromissos na agenda.

                Lidar com a análise de data e hora, verificação de disponibilidade e criação de eventos.

                Entrada: Solicitação de agendamento em linguagem natural (ex.: 'reunião com a equipe de design na próxima terça-feira às 14h')
            
            `.trim(),
            schema: z.object({
                request: z.string().describe("Solicitação de agendamento em linguagem natural.")
            })
        }
    )

    const manageEmail = tool(
        async ({request}:any) => {
            const result = await emailAgent.invoke({
                messages: [{role: "user", content:request}]
            })
            const lastMessage = result.messages[result.messages.length -1]
            return lastMessage.text
        },
        {
            name:"manage_email",
            description:`
                Envie e-mails usando linguagem natural.

                Use esta funcionalidade quando o usuário desejar enviar notificações, lembretes ou qualquer comunicação por e-mail.
                Ele lida com a extração do destinatário, a geração do assunto e a composição do e-mail.

                Entrada: Solicitação de e-mail em linguagem natural (ex.: 'enviar um lembrete sobre a reunião.)
            `.trim(),
            schema: z.object({
                request: z.string().describe("Solicitação de e-mail em linguagem natural")
            })
        }
    )

    // agente supervisor que orquestra subAgentes.

    const supervisorAgent = createAgent({
        model: fastModel,
        tools: [scheduleEvent,manageEmail],
        systemPrompt: `
            Você é um assistente pessoal prestativo.
            Você pode agendar eventos na agenda e enviar e-mails.
            Divida as solicitações do usuário em chamadas de ferramentas apropriadas e coordene os resultados.

            Quando uma solicitação envolve várias ações, use várias ferramentas em sequência.
        
        `
    })

    const result = await supervisorAgent.invoke({
        messages: [{ role: "user", content: pedido }]
    })

    const lastMessage = result.messages[result.messages.length - 1]
    return lastMessage.text








}