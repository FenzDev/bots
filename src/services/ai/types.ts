import type { z } from "zod";

// ----------------------------------------
// JSON
// ----------------------------------------

export type JSONPrimitive = string | number | boolean | null;

export type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | { [key: string]: JSONValue };

// ----------------------------------------
// Provider-agnostic messages
// ----------------------------------------

export type AIRole = "system" | "user" | "assistant" | "tool_result";

export type AIMessage = {
  role: AIRole;
  content: string;
};

export type AIPrompt = AIMessage[];

// ----------------------------------------
// Tools
// ----------------------------------------

export type AITool<TArgs = unknown> = {
  name: string;
  description: string;

  examples?: string[];

  schema: z.ZodType<TArgs>;

  execute: (args: TArgs) => Promise<JSONValue> | JSONValue;
};

export type AIToolCall = {
  /**
   * Provider-generated ID.
   *
   * Some providers require this to associate a tool
   * result with a particular tool call.
   */
  id?: string;

  name: string;
  args: Record<string, JSONValue>;
};

// ----------------------------------------
// AI responses
// ----------------------------------------

export type AITextPart = {
  type: "text";
  content: string;
};

export type AIToolCallPart = {
  type: "tool_call";
  call: AIToolCall;
};

export type AIResponsePart = AITextPart | AIToolCallPart;

export type AIProviderState = unknown;

export type AIResponse = {
  parts: AIResponsePart[];
  state?: AIProviderState;
};

// ----------------------------------------
// Provider
// ----------------------------------------

export interface AIProvider {
  generate(
    prompt: AIPrompt,
    tools?: AITool[],
    state?: AIProviderState,
  ): Promise<AIResponse>;

  isAvailable(): Promise<boolean>;
}

// ----------------------------------------
// Application
// ----------------------------------------

export type AIRawPayload<TContext> = {
  /**
   * Current application context.
   */
  context: TContext;

  /**
   * What the AI should currently do.
   */
  instruction: string;
};

export interface AIApplication<TInput, TContext, TResult> {
  /**
   * Base personality/instructions for this application.
   */
  personality: string;

  /**
   * Tools available to this application.
   */
  tools: AITool[];
  
  /**
   * Optional schema describing the expected final AI output.
   */
  resultSchema?: z.ZodType<TResult>;

  /**
   * Builds the AI working context from the raw application input.
   */
  buildContext(input:TInput): Promise<TContext>;

  /**
   * Converts application-specific context into an
   * AI-readable and token-efficient prompt.
   */
  serialize(payload: AIRawPayload<TContext>): AIPrompt;

  /**
   * Adds a tool result to the application-specific context.
   */
  addToolResult(
    context: TContext,
    call: AIToolCall,
    result: JSONValue,
  ): TContext;
}
