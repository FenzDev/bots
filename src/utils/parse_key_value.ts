import { z } from "zod";

export function parseKeyValueInput<T extends z.ZodType>(
  rawInput: string,
  schema: T,
): {
  result?: z.infer<T>;
  error?: string;
} {
  const input = rawInput.trim();

  if (!input) {
    return {
      error: "No input was provided.",
    };
  }

  const values: Record<string, string> = {};

  const pairRegex = /([a-zA-Z][a-zA-Z0-9]*)=(?:'([^']*)'|([^\s]+))/g;

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = pairRegex.exec(input)) !== null) {
    const between = input.slice(lastIndex, match.index).trim();

    if (between) {
      return {
        error: `Invalid syntax near "${between}". Expected key=value.`,
      };
    }

    const [, key, quotedValue, unquotedValue] = match;
    const value = quotedValue ?? unquotedValue;

    if (key in values) {
      return {
        error: `Duplicate key "${key}".`,
      };
    }

    values[key] = value;
    lastIndex = pairRegex.lastIndex;
  }

  const remaining = input.slice(lastIndex).trim();

  if (remaining) {
    return {
      error: `Invalid syntax near "${remaining}". Expected key=value.`,
    };
  }

  if (!Object.keys(values).length) {
    return {
      error: "No valid key=value pairs were provided.",
    };
  }

  const result = schema.safeParse(values);

  if (!result.success) {
    const issue = result.error.issues[0];

    return {
      error: `${issue.path.join(".") || "input"}: ${issue.message}`,
    };
  }

  return {
    result: result.data,
  };
}