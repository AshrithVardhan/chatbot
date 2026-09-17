// Shared MongoDB connection with caching across serverless function invocations
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;

// Cache the connection to reuse across warm invocations
let cached = global._mongoConn;
if (!cached) {
  cached = global._mongoConn = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGO_URI, { bufferCommands: false })
      .then(m => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// ── Session model (defined here to avoid re-declaration across functions) ──
import { Schema, models, model } from 'mongoose';

const messageSchema = new Schema({
  role:      { type: String, enum: ['user', 'ai'], required: true },
  content:   { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const sessionSchema = new Schema({
  title:     { type: String, default: 'New Conversation' },
  messages:  [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

sessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Session = models.Session || model('Session', sessionSchema);
