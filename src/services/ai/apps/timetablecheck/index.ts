import z, { ZodType } from "zod";
import { $ZodTypeInternals } from "zod/v4/core";
import {
  AIApplication,
  AIPrompt,
  AIRawPayload,
  AITool,
  AIToolCall,
  JSONValue,
} from "../../types";
import { prompts } from "../../prompts";

const timetableSessionSchema = z.object({
  teacher:z.string().nullable(),
  classroom:z.string().nullable(),
  startTime:z.string().nullable(),
  day:z.string().nullable(),
});
const timetableCheckAIResultSchema = z.object({
  numOfAllGroupsExistingInTable: z.number(),
  changesFromAtoB: z.array(
    z.object({
      groupsInvolved: z.array(
        z.enum([
          "ALL",
          "G1",
          "G2",
          "G3",
          "G4",
          "G5",
          "G6",
          "G7",
          "G8",
          "G9",
          "G10",
          "G11",
          "G12",
        ]),
      ),
      subjectTitle:z.string(),
      sessionType:z.enum([
        'LECTURE',
        'TUTORIAL',
        'LAB',
        'NONE'
      ]),
      from:z.nullable(timetableSessionSchema),
      to:z.nullable(timetableSessionSchema),
    }),
  ),
});

export type TimetableSession = z.infer<
  typeof timetableSessionSchema
>;
export type TimetableCheckAIResult = z.infer<
  typeof timetableCheckAIResultSchema
>;

export type TimetableCheckAIInput = {
  tableAGridJSON: string;
  tableBGridJSON: string;
};

type TimetableCheckAIContext = TimetableCheckAIInput;

export class TimetableCheckAIApp implements AIApplication<
  TimetableCheckAIInput,
  TimetableCheckAIContext,
  TimetableCheckAIResult
> {
  constructor() {
    this.personality = prompts["personalities/timetablebot"];
    this.tools = [];
    this.resultSchema = timetableCheckAIResultSchema;
  }

  personality: string;
  tools: AITool<unknown, unknown>[];
  resultSchema?:
    | ZodType<
        TimetableCheckAIResult,
        unknown,
        $ZodTypeInternals<TimetableCheckAIResult, unknown>
      >
    | undefined;

  async buildContext(
    input: TimetableCheckAIInput,
  ): Promise<TimetableCheckAIInput> {
    return { ...input };
  }
  serialize({
    context,
    instruction,
  }: AIRawPayload<TimetableCheckAIInput>): AIPrompt {
    const resultFormat = this.resultSchema
      ? JSON.stringify(this.resultSchema.toJSONSchema(), null, 2)
      : undefined;

    return {
      useHighThinking: true,
      parts: [
        {
          role: "system",
          content: `# Personality
${this.personality}`,
        },
        {
          role: "system",
          content: `# Instruction
${instruction}`,
        },
        {
          role: "system",
          content: `# Result format
Follow the exact format, when you output any text.
${resultFormat ?? "No structured result format required."}
`,
        },
        {
          role: "user",
          content: `# Table A (the old/previous csv table)
${context.tableAGridJSON}
        `,
        },
        {
          role: "user",
          content: `# Table B (the new/possibly-changed csv table)
${context.tableBGridJSON}
        `,
        },
      ],
    };
  }
  addToolResult(
    context: TimetableCheckAIInput,
    call: AIToolCall,
    result: JSONValue,
  ): TimetableCheckAIInput {
    throw new Error("Method not implemented.");
  }
}
