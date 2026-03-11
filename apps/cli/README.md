# @noob-cli/cli

The interactive terminal frontend for Noob CLI. This package parses user commands, renders the console UI, and streams real-time responses and tool execution states from the core engine.

## 🖥️ UI Architecture

* **`/cli.ts`**: The main entry point. Uses `commander` to parse flags and arguments. It also includes an auto-start mechanism that boots the `@noob-cli/core` server in the background if it isn't already running.
* **`/ui/session.ts`**: Manages the WebSocket connection (`ws://127.0.0.1:4000/api/chat/ws`) to the core server. It handles the complex terminal rendering, multiplexing the output between the primary Agent, system tool states (spinners), and the background Buddy persona.

## 🎨 Interface Features

* **Dual-Stream Output:** Simultaneously renders the primary technical AI and the secondary conversational Buddy without breaking the terminal layout.
* **Live Tool States:** Uses `ora` spinners and `chalk` styling to provide real-time visual feedback when the AI is reading files, writing code, or executing shell commands.
* **Interactive Prompt:** Supports continuous chat sessions and intercepts special commands (like `!buddy`) to talk directly to the background persona.

## 💻 Development

If you are modifying the terminal interface, adding new CLI flags, or adjusting the chat rendering, you can run the CLI in development mode:

```bash
pnpm dev:cli [optional prompt]
```

To test the CLI without triggering the core engine, ensure the core server (`pnpm dev:core`) is running in a separate terminal tab so you can monitor the WebSocket payloads.