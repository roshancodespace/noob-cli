# Connecting to the AI Core

Let's get your frontend talking to the engine. There are **two ways** to wire up your app. Just pick the one that fits your use case.

* **REST API** → Simple request, final response.
* **WebSockets** → Live streaming and real-time events.

---

## 1. The Quick & Simple Way (REST API)

Use this if you just want to **send a prompt and get a final answer** back. 

It's perfect for single-shot queries or background tasks. No streaming, no live updates—just a standard, reliable API request.

### Endpoint

```http
POST http://127.0.0.1:4000/api/chat/ask
```

### Example

```javascript
async function askAI() {
  const response = await fetch("[http://127.0.0.1:4000/api/chat/ask](http://127.0.0.1:4000/api/chat/ask)", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: "What operating system am I running?",
      provider: "gemini"
    })
  });

  const data = await response.json();
  console.log("AI says:", data.response);
}

askAI();
```

That's it. Fire off the prompt, get your answer.

---

## 2. The Live & Interactive Way (WebSockets)

Use this if you are building a more dynamic experience, such as:

* A **chat interface**
* A **live AI assistant**
* An **agent dashboard**

With WebSockets, the connection stays open. The AI streams its thoughts, tool executions, and sidekick banter in real-time as it works.

### Connect

```javascript
const chatLine = new WebSocket("ws://127.0.0.1:4000/api/chat/ws");
```

### Start a Task

```javascript
chatLine.onopen = () => {
  console.log("Connected and ready!");

  chatLine.send(JSON.stringify({
    action: "main_task",
    prompt: "Check my git status.",
    provider: "groq",
    buddyMode: true
  }));
};
```

---

## Listening for Messages

Because the WebSocket is a live feed, the engine will send different types of messages depending on what the AI is currently doing. Here is how to handle them:

### AI Text Output

When the main technical agent is speaking.

```javascript
case "content":
  process.stdout.write(message.content);
  break;
```

### Sidekick Messages (Buddy Mode)

When your background conversational persona chimes in.

```javascript
case "buddy_content":
  console.log("[Sidekick]:", message.content);
  break;
```

### Tool Execution

When the AI rolls up its sleeves to run a local command.

```javascript
case "tool_start":
  console.log("Running:", message.name);
  break;
```

### Dangerous Command (Needs Approval)

The safety net. When the AI attempts a potentially risky action, it pauses and waits for your green light.

```javascript
case "action_approval":
  const approved = confirm("Allow this command?");

  // Send the verdict back to the engine
  chatLine.send(JSON.stringify({
    action: "approval_response",
    approved
  }));
  break;
```

### Task Finished

The engine has completely finished processing the request.

```javascript
case "task_complete":
  console.log("All done!");
  break;
```

### Error Handling

When things go sideways.

```javascript
case "server_error":
  console.error("Error:", message.message);
  break;
```

---

## Summary: Which one should you use?

* Use the **REST API** if you just want quick, one-off answers.
* Use **WebSockets** if you're building a rich, agent-style UI where the user needs to see the AI working in real-time.
