import z from "zod";
import logger from "../lib/logger";
import { configDotenv } from "dotenv";
import { cronSchema, telegramTargetSchema } from "./schemas";

configDotenv({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),

  PORT: z.coerce.number().default(3000),
  WEB_URL: z.url(),

  TELEGRAM_CHILLBOT_TOKEN: z.string().nonempty(),
  TELEGRAM_GUARDBOT_TOKEN: z.string().nonempty(),
  TELEGRAM_RESOURCESBOT_TOKEN: z.string().nonempty(),
  TELEGRAM_TIMETABLEBOT_TOKEN: z.string().nonempty(),
  TELEGRAM_CHILLBOT_USERNAME: z.string().nonempty(),
  TELEGRAM_GUARDBOT_USERNAME: z.string().nonempty(),
  TELEGRAM_RESOURCESBOT_USERNAME: z.string().nonempty(),
  TELEGRAM_TIMETABLEBOT_USERNAME: z.string().nonempty(),
  TELEGRAM_WEBHOOK_SECRET: z.string().nonempty(),
  TELEGRAM_SUPERADMIN_ID: z.coerce.number(),
  TELEGRAM_SUPERADMIN_USERNAME: z.string(),
  MONGODB_URI: z.string().nonempty(),
  DB_MAX_HISTORY_MESSAGES: z.coerce.number(),
  GOOGLE_AI_API_KEY: z.string().nonempty(),
  TIMETABLE_CHECK_SCHEDULE: cronSchema,
  TIMETABLE_CHECK_SETTLEMENT_DELAY: z.coerce.number(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  logger.error(result.error.message);
  process.exit(1);
}

const env = result.data;

// Destructure for easier auto-completion
export const {
  NODE_ENV,
  PORT,
  WEB_URL,

  TELEGRAM_CHILLBOT_TOKEN,
  TELEGRAM_GUARDBOT_TOKEN,
  TELEGRAM_TIMETABLEBOT_TOKEN,
  TELEGRAM_RESOURCESBOT_TOKEN,
  TELEGRAM_CHILLBOT_USERNAME,
  TELEGRAM_GUARDBOT_USERNAME,
  TELEGRAM_TIMETABLEBOT_USERNAME,
  TELEGRAM_RESOURCESBOT_USERNAME,
  TELEGRAM_WEBHOOK_SECRET,
  TELEGRAM_SUPERADMIN_ID,
  TELEGRAM_SUPERADMIN_USERNAME,
  
  DB_MAX_HISTORY_MESSAGES,

  TIMETABLE_CHECK_SCHEDULE,
  TIMETABLE_CHECK_SETTLEMENT_DELAY,
  
  MONGODB_URI,
  GOOGLE_AI_API_KEY,
} = env;
