import { MongoClient } from "mongodb";
import { MONGODB_URI } from "../config/env.js";
import logger from "./logger.js";

const client = new MongoClient(MONGODB_URI);

export async function connectDatabase() {
  await client.connect();
  logger.info("Connected to MongoDB");
}

export const db = client.db();