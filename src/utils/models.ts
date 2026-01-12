import { ChatOpenAI } from "@langchain/openai";

export const fastModel = new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: process.env.API_KEY
})

export const advancedModel = new ChatOpenAI({
    model: "gpt-5",
    apiKey: process.env.API_KEY,
  
});
