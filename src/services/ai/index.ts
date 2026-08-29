import type { z } from "zod";

import { ChatbotAIApp } from "./apps/chatbot/";

import { AIApplication, AITextPart, AIToolCallPart } from "./types";

import { prompts } from "./prompts/";
import { GemmaProvider } from "./providers/google-ai-provider";

export const chillbotAIApp = new ChatbotAIApp(
  "chillbot",
  prompts["personalities/chillbot"],
);

let currentProvider = new GemmaProvider();

const MAX_STEPS = 2;

export async function runAIApp<TInput, TContext, TResult>(
  app: AIApplication<TInput, TContext, TResult>,
  input: TInput,
  instruction: string,
  onResponse?: (result: TResult | string) => void | Promise<void>,
): Promise<TResult|String> {
  let context = (await app.buildContext(input));

  for (let step = 0; step < MAX_STEPS; step++) {
    // ----------------------------------------
    // Build prompt
    // ----------------------------------------

    const prompt = app.serialize({
      context,
      instruction,
    });

    // ----------------------------------------
    // Ask AI
    // ----------------------------------------

    const response = await currentProvider.generate(
      prompt,
      app.tools,
    );

    // ----------------------------------------
    // Get text
    // ----------------------------------------

    const textParts = response.parts.filter(
      (part): part is AITextPart =>
        part.type === "text",
    );

    const text = textParts
      .at(-1)
      ?.content;

    // ----------------------------------------
    // Handle tool calls
    // ----------------------------------------

    const toolCalls = response.parts.filter(
      (part): part is AIToolCallPart =>
        part.type === "tool_call",
    );

    if (toolCalls.length > 0) {
      // If the AI said something before using
      // the tool, notify the application.
      if (text) {
        const parsed = extractResponse<TResult>(
          app,
          text,
        );

        await onResponse?.(parsed);
      }

      for (const part of toolCalls) {
        const tool = app.tools.find(
          (tool) => tool.name === part.call.name,
        );

        if (!tool) {
          throw new Error(
            `AI requested unknown tool: ${part.call.name}`,
          );
        }

        // AI-generated arguments are untrusted.
        const args = tool.schema.parse(
          part.call.args,
        );

        const toolResult = await tool.execute(args);

        context = await app.addToolResult(
          context,
          part.call,
          toolResult,
        );
      }

      // Tool was used, so ask the AI again.
      continue;
    }

    // ----------------------------------------
    // No tools = final response
    // ----------------------------------------

    if (!text) {
      throw new Error(
        "AI returned neither text nor tool calls",
      );
    }

    const result = extractResponse<TResult>(
      app,
      text,
    );

    await onResponse?.(result);

    return result;
  }

  throw new Error(
    `AI exceeded maximum number of steps (${MAX_STEPS})`,
  );
}

function extractResponse<TResult>(
  app: AIApplication<any, any, TResult>,
  text: string,
): TResult | string {
  if (!app.resultSchema) {
    return text;
  }

  try {
    return app.resultSchema.parse(
      parseAIJson(text),
    );
  } catch {
    // Model didn't follow the JSON format.
    // Treat it as ordinary text.
    return text;
  }
}

function parseAIJson(text: string): unknown {
  const trimmed = text.trim();

  const fenced = trimmed.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
  );

  const json = fenced?.[1] ?? trimmed;

  return JSON.parse(json);
}