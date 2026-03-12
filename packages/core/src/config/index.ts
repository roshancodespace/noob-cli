import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
    path: path.resolve(__dirname, "../../../../.env")
});

const configSchema = z.object({
    AI_PROVIDER: z.enum(['groq', 'ollama', 'llama', 'gemini']).default('llama'),
    MODEL: z.string().default('default'),
    DEBUG: z.preprocess((val) => val === 'true', z.boolean()).default(false),
    GROQ_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),
    LLAMA_BASE_URL: z.url().default('http://localhost:8080'),
    LLAMA_API_KEY: z.string().default('default'),

    PORT: z.coerce.number().default(4000),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.message);
    process.exit(1);
}

export const config = {
    llm: {
        provider: parsed.data.AI_PROVIDER,
        model: parsed.data.MODEL,
        apiKey: parsed.data.GROQ_API_KEY || parsed.data.GOOGLE_GENERATIVE_AI_API_KEY || '',
    },
    server: {
        port: parsed.data.PORT,
        debug: parsed.data.DEBUG
    },
    providers: {
        groq: { apiKey: parsed.data.GROQ_API_KEY },
        ollama: { baseUrl: parsed.data.OLLAMA_BASE_URL },
        llama: { baseUrl: parsed.data.LLAMA_BASE_URL, apiKey: parsed.data.LLAMA_API_KEY },
        gemini: { apiKey: parsed.data.GOOGLE_GENERATIVE_AI_API_KEY }
    }
};