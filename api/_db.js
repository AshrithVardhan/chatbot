const mongoose = require('mongoose');

// ── Session Model ─────────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'ai'], required: true },
  content:   { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const sessionSchema = new mongoose.Schema({
  title:     { type: String, default: 'New Conversation' },
  messages:  [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

sessionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

// ── MongoDB Connection (cached across warm invocations) ───────────────────────
let cached = { conn: null, promise: null };

async function connectDB() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('MONGO_URI environment variable is not set on Vercel!');

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

module.exports = { connectDB, Session };
