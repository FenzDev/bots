import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readPrompt<const TName extends string>(
  name: TName,
) {
  return {
    [name]: readFileSync(join(__dirname, `${name}.md`), "utf8"),
  } as Record<TName, string>;
}

function definePrompts<
  const T extends readonly Record<string, string>[],
>(...prompts: T): {
  [K in T[number] as keyof K]: K[keyof K];
} {
  return Object.assign({}, ...prompts);
}

export const prompts = definePrompts(
  readPrompt("personalities/chillbot"),
  readPrompt("personalities/timetablebot"),
  readPrompt("instructions/timetablebot/compare"),
  readPrompt("instructions/chillbot/replyToMentions"),
);