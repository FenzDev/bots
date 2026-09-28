import type { Collection } from "mongodb";

import { db } from "../lib/mongodb.js";

export type RuntimeConfig = {
  _id: "global";
  timetablesId: string;
  defaultStorageChatId?: number;
  defaultStorageThreadId?: number;
  weatherForcastChannelId: number;
};

export type RuntimeConfigInput = Omit<RuntimeConfig, "_id">;

const collection: Collection<RuntimeConfig> =
  db.collection<RuntimeConfig>("runtime_config");

async function get(): Promise<RuntimeConfig> {
  const config = await collection.findOne({ _id: "global" });

  if (config) {
    return config;
  }

  const defaultConfig: RuntimeConfig = {
    _id: "global",
    timetablesId: "",
    defaultStorageChatId: undefined,
    defaultStorageThreadId: undefined,
    weatherForcastChannelId: 0,
  };

  await collection.insertOne(defaultConfig);

  return defaultConfig;
}

async function update(config: RuntimeConfigInput) {
  return collection.updateOne(
    { _id: "global" },
    {
      $set: config,
    },
    { upsert: true },
  );
}

export const runtimeConfig = {
  get,
  update,
};