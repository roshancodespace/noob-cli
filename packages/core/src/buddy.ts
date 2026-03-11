import { Agent } from "./agent.js";
import { StreamChunk } from "./llm/types.js";

const BUDDY_PROMPT = `You are the highly sophisticated, formal, and dryly witty conversational interface of "Noob CLI", the user's terminal AI. You embody the exact persona and speaking style of J.A.R.V.I.S. from Iron Man. You are the eloquent voice speaking while your background subroutines process the user's request. 
Strict Rules:
1. Give ONE short, exceedingly polite, and dryly clever comment (1-2 sentences). Do NOT use emojis. Rely on eloquent, formal vocabulary.
2. CONTEXT IS KING: Relate your response directly to the user's request or the current system task (e.g., "Accessing the mainframes," "Compiling the requested data").
3. Speak in the first person ("I am initializing the protocol", "Right away"). Address the user respectfully (e.g., "Sir", "Ma'am", or "Boss"). Do NOT refer to a separate "main AI".
4. Never output technical data, commands, or code. Leave the heavy lifting to your background subroutines.`;

export async function* withBuddyMode(
    userPrompt: string,
    workerStream: AsyncIterable<StreamChunk>,
    buddyAgent: Agent
): AsyncIterable<StreamChunk> {
    const workerIterator = workerStream[Symbol.asyncIterator]();
    const firstWorkerChunkPromise = workerIterator.next();

    // let buddySpoke = false;
    // try {
    //    const introPrompt = `User asked: "${userPrompt}". Your technical subroutines are thinking deeply right now. Give a quick, funny 1-sentence intro to fill the silence while you start working!`;
    //     for await (const bc of buddyAgent.askStream(introPrompt, BUDDY_PROMPT, true)) {
    //         if (bc.type === "content") {
    //             buddySpoke = true;
    //             yield { type: "buddy_content" as const, content: bc.content };
    //         }
    //     }
    // } catch {
    // } finally {
    //     if (buddySpoke) yield { type: "buddy_content" as const, content: "\n" };
    // }

    let workerResult = await firstWorkerChunkPromise;
    let aiContentBuffer = "";

    while (!workerResult.done) {
        const chunk = workerResult.value;
        
        yield chunk;

        if (chunk.type === "content") {
            aiContentBuffer += chunk.content;
        }

        if (chunk.type === "tool_start") {
            let buddySpoke = false;
            try {
                const prompt = `You are currently running the system tool "${chunk.name}". Say something clever and short to entertain the user while you wait for the tool to finish executing.`;
                for await (const bc of buddyAgent.askStream(prompt, BUDDY_PROMPT, true)) {
                    if (bc.type === "content") {
                        buddySpoke = true;
                        yield { type: "buddy_content" as const, content: bc.content };
                    }
                }
            } catch {
            } finally {
                if (buddySpoke) yield { type: "buddy_content" as const, content: "\n" };
            }
        }

        workerResult = await workerIterator.next();
    }

    // const trimmedAiContent = aiContentBuffer.trim();
    // if (trimmedAiContent.length > 0) {
    //     let buddySpoke = false;
    //     try {
    //         const prompt = `User said: "${userPrompt}". Your technical side just provided this response: "${trimmedAiContent.substring(0, 300)}...". Give a single witty, friendly closing remark to wrap up your answer perfectly.`;
    //         for await (const bc of buddyAgent.askStream(prompt, BUDDY_PROMPT, true)) {
    //             if (bc.type === "content") {
    //                 buddySpoke = true;
    //                 yield { type: "buddy_content" as const, content: bc.content };
    //             }
    //         }
    //     } catch {
    //     } finally {
    //         if (buddySpoke) yield { type: "buddy_content" as const, content: "\n" };
    //     }
    // }
}