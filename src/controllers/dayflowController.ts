import {Request, Response} from 'express'
import { dayflowService } from '../service/dayflowService'

export const dayflowController = async (req:Request, res:Response) => {

    const {pedido} = req.body

    if(!pedido){
        return res.status(400).json({
            error: "Campo pedido obrigatorio"
        })
    }

    try {

        const response = await dayflowService(pedido)

        return res.status(200).json(response)
        
    } catch (error) {

        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
        console.log(errorMessage)
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
        
    }

}