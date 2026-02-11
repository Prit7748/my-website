import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// eslint-disable-next-line no-var
declare global {
  var mongoose: MongooseCache | undefined;
}

const globalCache = global.mongoose || (global.mongoose = { conn: null, promise: null });

export default async function dbConnect(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Add it to .env.local (local) and Vercel Environment Variables (prod)."
    );
  }

  // ✅ if already connected, return
  if (mongoose.connection.readyState === 1 && globalCache.conn) {
    return globalCache.conn;
  }

  // ✅ if a connection is in progress, wait for it
  if (!globalCache.promise) {
    globalCache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}
