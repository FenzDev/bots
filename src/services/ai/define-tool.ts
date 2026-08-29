import z from "zod";
import { AITool, JSONValue } from "./types";

export function defineTool<TSchema extends z.ZodTypeAny>(tool: {
  name: string;
  description: string;
  examples?: string[];
  schema: TSchema;
  execute: (args: z.infer<TSchema>) => Promise<JSONValue> | JSONValue;
}): AITool<z.infer<TSchema>> {
  return tool as AITool<z.output<TSchema>>;
}