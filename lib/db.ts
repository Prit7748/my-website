// lib/db.ts
import mongoose from "mongoose";

const DB_NAME = String(process.env.MONGODB_DB || "ignoucluster").trim();

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  isListenersAttached: boolean;
  lastUri: string;
  lastDbName: string;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global.mongooseCache ||
  (global.mongooseCache = {
    conn: null,
    promise: null,
    isListenersAttached: false,
    lastUri: "",
    lastDbName: "",
  });

function safeStr(x: unknown) {
  return String(x ?? "").trim();
}

function attachConnectionListenersOnce() {
  if (cached.isListenersAttached) return;
  cached.isListenersAttached = true;

  mongoose.connection.on("disconnected", () => {
    cached.conn = null;
  });

  mongoose.connection.on("error", () => {
    cached.conn = null;
  });
}

async function safeDisconnectIfNeeded() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch {
    // ignore cleanup errors
  } finally {
    cached.conn = null;
    cached.promise = null;
  }
}

export default async function dbConnect() {
  const MONGODB_URI = safeStr(process.env.MONGODB_URI);

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  attachConnectionListenersOnce();
  mongoose.set("strictQuery", true);

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const uriChanged = cached.lastUri !== MONGODB_URI;
  const dbChanged = cached.lastDbName !== DB_NAME;

  if (uriChanged || dbChanged) {
    await safeDisconnectIfNeeded();
    cached.lastUri = MONGODB_URI;
    cached.lastDbName = DB_NAME;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: DB_NAME,

        // Connection stability
        serverSelectionTimeoutMS: 20000,
        connectTimeoutMS: 20000,
        socketTimeoutMS: 60000,
        heartbeatFrequencyMS: 10000,
        maxIdleTimeMS: 30000,

        // Pool
        maxPoolSize: 10,
        minPoolSize: 0,

        // Retry behavior
        retryWrites: true,
        retryReads: true,

        // Helpful on some Atlas / platform network paths
        family: 4,

        // Safer defaults
        autoIndex: false,
        bufferCommands: false,
      })
      .then((mongooseInstance) => {
        cached.conn = mongooseInstance;
        return mongooseInstance;
      })
      .catch(async (error) => {
        cached.promise = null;
        cached.conn = null;

        try {
          if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
          }
        } catch {
          // ignore cleanup errors
        }

        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
}