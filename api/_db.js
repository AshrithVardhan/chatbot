// Shared MongoDB connection + Session model for all serverless functions
// ALL imports must be at the top in ES modules
import mongoose, { Schema, models, model } from 'mongoose';

// ── Session Model ─────────────────────────────────────────────────────────────
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

sessionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Session = models.Session || model('Session', sessionSchema);

// ── MongoDB Connection (cached across warm invocations) ───────────────────────
let cached = { conn: null, promise: null };

export async function connectDB() {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not set on Vercel!');
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
