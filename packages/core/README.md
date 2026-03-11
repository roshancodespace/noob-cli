# @noob-cli/core

The headless engine behind Noob CLI. This package handles LLM orchestration, secure native tool execution, and hosts the WebSocket server that communicates with the frontend CLI.

## 🏗️ Internal Architecture

* **`/llm`**: Model integrations (Gemini, Groq, Ollama, Llama) powered by the Vercel AI SDK.
* **`/tools`**: Native capabilities allowing the AI to read, write, and patch files, or execute shell commands.
* **`/agent.ts` & `/buddy.ts**`: The core logic. `agent.ts` handles task chaining, while `buddy.ts` intercepts states to power the secondary conversational persona.
* **`/safety.ts`**: The execution sandbox and validation layer.
* **`/server.ts`**: A Fastify WebSocket server (`ws://127.0.0.1:4000`) for streaming responses and tool states.

## 🛡️ Security Model

All terminal commands requested by the AI pass through a strict validation layer before reaching `child_process.exec`.

* **Scope Isolation:** Rejects absolute paths and `../` traversals to keep the AI locked to the current working directory.
* **Executable Whitelist:** Only permits recognized, safe binaries (e.g., `npm`, `git`, `ls`, `mkdir`).
* **Fatal Pattern Blocking:** Hard-blocks known destructive commands (e.g., `rm -rf /`).

## 💻 Development

If you are building new tools, adjusting the safety layer, or adding new LLM providers, you can run the core server in watch mode:

```bash
pnpm dev:core
```