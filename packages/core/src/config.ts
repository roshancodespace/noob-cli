import 'dotenv/config';

export const config = {
    llm: {
        provider: process.env.AI_PROVIDER || 'llama',
        apiKey: process.env.GROQ_API_KEY || '',
        model: process.env.MODEL || 'default',
    }
};
