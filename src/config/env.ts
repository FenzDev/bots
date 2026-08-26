import z from "zod";
import logger from "../lib/logger";
import { configDotenv } from "dotenv";
import { telegramTargetSchema } from "./schemas";

configDotenv({quiet:true});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),

  PORT: z.coerce.number().default(3000),

  TELEGRAM_CHILLBOT_TOKEN: z.string(),
  TELEGRAM_GUARDBOT_TOKEN: z.string(),
  TELEGRAM_ARCHIVEBOT_TOKEN: z.string(),
  TELEGRAM_TIMETABLEBOT_TOKEN: z.string(),
  TELEGRAM_SUPERADMIN_ID: z.coerce.number(),
  TELEGRAM_SUPERADMIN_USERNAME: z.string(),
  // TELEGRAM_ARCHIVE_TARGET: telegramTargetSchema,
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
  
  TELEGRAM_ARCHIVEBOT_TOKEN,
  TELEGRAM_CHILLBOT_TOKEN,
  TELEGRAM_GUARDBOT_TOKEN,
  TELEGRAM_TIMETABLEBOT_TOKEN,
  TELEGRAM_SUPERADMIN_ID,
  TELEGRAM_SUPERADMIN_USERNAME,
  // BOT_TOKEN,
} = env;