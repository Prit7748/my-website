// lib/db.ts
import mongoose from "mongoose";

const DB_NAME = process.env.MONGODB_DB || "ignoucluster";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached =
  global.mongooseCache || (global.mongooseCache = { conn: null, promise: null });

export default async function dbConnect() {
  if (cached.conn) return cached.conn;

  // ✅ Force runtime string (no "string | undefined" left for TS)
  const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  if (!cached.promise) {
    mongoose.set("strictQuery", true);

    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 0,
      retryWrites: true,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
