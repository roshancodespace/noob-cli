import { GeminiProvider } from './gemini.js';
import { GroqProvider } from './groq.js';
import { LlamaProvider } from './llama.js';
import { OllamaProvider } from './ollama.js';
import { LLMOptions, LLMProvider } from './types.js';

export interface ProviderOptions extends LLMOptions {
    provider: string;
}

export function createProvider(options: ProviderOptions): LLMProvider {
    switch (options.provider.toLowerCase()) {
        case 'groq':
            return new GroqProvider(options);
        case 'ollama':
            return new OllamaProvider(options);
        case 'llama':
            return new LlamaProvider(options);
        case 'gemini':
            return new GeminiProvider(options);
        default:
            throw new Error(`Unsupported AI provider: ${options.provider}`);
    }
}
