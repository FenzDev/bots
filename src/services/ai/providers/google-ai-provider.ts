import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  type AIProvider,
  type AIPrompt,
  type AIResponse,
  type AITool,
  type AIToolCall,
  type AIResponsePart,
  type AIProviderState,
  type JSONValue,
} from "../types";

import { GOOGLE_AI_API_KEY } from "../../../config/env";
import logger from "../../../lib/logger";

type GemmaState = {
  interactionId: string;
};

export class GemmaProvider implements AIProvider {
  private readonly ai: GoogleGenAI;
  private readonly model = "gemma-4-26b-a4b-it";

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: GOOGLE_AI_API_KEY,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.ai.interactions.create({
        model: this.model,
        input: "ping",
        store: false,
      });

      return true;
    } catch {
      return false;
    }
  }

  async generate(
    prompt: AIPrompt,
    tools: AITool[] = [],
    state?: AIProviderState,
  ): Promise<AIResponse> {

    logger.debug({prompt,tools,state},'Prompts and tools received by provider:')

    const gemmaState = state as GemmaState | undefined;

    const interaction = await this.ai.interactions.create({
      model: this.model,

      system_instruction: this.getSystemInstruction(prompt),

      generation_config: {
        thinking_summaries: "auto",
        thinking_level: "high",
      },

      input: this.getInput(prompt),

      tools: tools?.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: z.toJSONSchema(tool.schema),
      })),

      ...(gemmaState?.interactionId
        ? {
            previous_interaction_id: gemmaState.interactionId,
          }
        : {}),

      store: true,
    });

    const parts: AIResponsePart[] = [];
    for (const step of interaction.steps ?? []) {
      logger.debug(step);
      if (step.type === "function_call") {
        parts.push({
          type: "tool_call",
          call: {
            id: step.id,
            name: step.name,
            args: step.arguments,
          },
        });
      }
    }

    if (interaction.output_text) {
      parts.push({
        type: "text",
        content: interaction.output_text,
      });
    }

    return {
      parts,

      state: {
        interactionId: interaction.id,
      } satisfies GemmaState,
    };
  }

  private getSystemInstruction(prompt: AIPrompt): string | undefined {
    const system = prompt
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    return system || undefined;
  }

  private getInput(prompt: AIPrompt): string {
    return prompt
      .filter((message) => message.role !== "system")
      .map((message) => {
        return `${message.role}:\n${message.content}`;
      })
      .join("\n\n");
  }
}
