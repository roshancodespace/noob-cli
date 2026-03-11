<div align="center">
  <h1>Noob CLI</h1>

  <h3>A locally-running terminal AI assistant with a dual-agent architecture</h3>

  <p>
    <a href="https://nodejs.org/">
      <img src="https://img.shields.io/badge/Node.js-%E2%89%A520-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js version" />
    </a>
    <a href="https://pnpm.io/">
      <img src="https://img.shields.io/badge/pnpm-%E2%89%A510.15.1-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm version" />
    </a>
    <a href="https://github.com/yourusername/noob-cli/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License" />
    </a>
  </p>

  <p>
    Let the background subroutines handle your complex code and system tasks, while the Buddy keeps you updated in the foreground.
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#usage">Usage</a> •
    <a href="#packages">Documentation</a>
  </p>

</div>

---

<h2 id="features">✨ Features</h2>

* **Bring Your Own Model:** Works out of the box with Groq, Ollama, Llama, and Gemini.
* **Native System Access:** Autonomously reads, writes, edits files, and executes shell commands.
* **Sandboxed Execution:** Strict directory isolation prevents the AI from modifying files outside your project root.
* **Buddy Mode:** A secondary, highly sophisticated conversational agent that chats with you while the primary agent works.

<h2 id="quick-start">🚀 Quick Start</h2>

**Prerequisites:** Node.js >= 20, pnpm >= 10.15.1

```bash
# Clone the repository
git clone [https://github.com/yourusername/noob-cli.git](https://github.com/yourusername/noob-cli.git)
cd noob-cli

# Install dependencies
pnpm install

# Configure your environment
cp .env.example .env
# Edit .env to add your API keys or local LLM URLs

# Build the project
pnpm build

```

<h2 id="usage">💻 Usage</h2>

You can fire off quick tasks directly from your terminal or drop into an interactive session.

**Interactive Session (with Buddy Mode)**

```bash
pnpm dev:cli -b

```

**One-Shot Command**

```bash
pnpm dev:cli "List all the TypeScript files in the src directory"

```

### Options

* `-p, --provider <name>`: Override default AI provider (`groq`, `ollama`, `llama`, `gemini`)
* `-m, --model <name>`: Specify the model to use
* `-b, --buddy`: Enable the background conversational sidekick
* `-c, --context <pattern>`: Load specific files into context using glob patterns

<h2 id="packages">📦 Packages & Documentation</h2>

This project is built as a monorepo. For deeper technical details, check out the documentation for the individual packages:

* **[@noob-cli/core](./packages/core/README.md)**: The headless engine handling LLM orchestration, secure native tool execution, and the WebSocket server.
* **[@noob-cli/cli](./apps/cli/README.md)**: The interactive terminal frontend, parsing commands and managing the dual-stream UI.