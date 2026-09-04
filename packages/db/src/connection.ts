import mongoose from "mongoose";

export interface DbConnectOptions {
  uri: string;
  dbName?: string;
}

let pending: Promise<typeof mongoose> | null = null;

/** Connect once. Safe to call repeatedly; returns the live connection. */
export async function connectDb(opts: DbConnectOptions): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (pending) return pending;

  mongoose.set("strictQuery", true);
  pending = mongoose
    .connect(opts.uri, {
      dbName: opts.dbName,
      serverSelectionTimeoutMS: 5000,
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

export type DbState = "disconnected" | "connected" | "connecting" | "disconnecting";

const STATE_NAMES: Record<number, DbState> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function dbState(): DbState {
  return STATE_NAMES[mongoose.connection.readyState] ?? "disconnected";
}

export { mongoose };
