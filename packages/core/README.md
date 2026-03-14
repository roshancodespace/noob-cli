# @noob-cli/core

Meet the brains of the operation. This is the headless engine powering Noob CLI. It handles all the heavy lifting: orchestrating the LLMs, safely executing native system tools, and hosting the server that feeds your frontend.

👉 **Want to build your own UI or connect an app?** Check out the [Integration Guide](./INTEGRATION.md) to see how to talk to the engine via REST or WebSockets.

## 🏗️ Internal Architecture

Here is how the engine is wired up under the hood:

* **`/llm`**: Model integrations (Gemini, Groq, Ollama, Llama) hooked up via the Vercel AI SDK. 
* **`/tools`**: The AI's hands. Native capabilities that allow the agent to read, write, and patch files, or fire off shell commands.
* **`/agent.ts` & `/buddy.ts`**: The core logic. `agent.ts` handles the complex task chaining, while `buddy.ts` intercepts the stream to power your secondary, conversational persona.
* **`/safety.ts`**: The bouncer. Our execution sandbox and strict validation layer.
* **`/server.ts`**: A Fastify server (`ws://127.0.0.1:4000`) for streaming real-time responses and tool states out to your interfaces.

## 🛡️ The Security Model

We don't let the AI run wild. Every terminal command requested by the agent hits a strict validation wall before it ever sees `child_process.exec`. 

* **Scope Isolation:** Rejects absolute paths and `../` traversals. The AI is strictly locked to your current working directory. No wandering.
* **Executable Whitelist:** Only permits recognized, safe binaries (think `npm`, `git`, `ls`, `mkdir`).
* **Fatal Pattern Blocking:** Hard-blocks notoriously destructive commands (e.g., `rm -rf /`). We like our hard drives un-wiped.

## 💻 Development

Want to tinker under the hood? If you are building new native tools, tweaking the safety bouncer, or wiring up new LLM providers, you can run the core server in watch mode:

```bash
pnpm dev:core