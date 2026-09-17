import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Groq from 'groq-sdk';
import Session from './models/Session.js';

const app  = express();
const PORT = process.env.PORT || 3001;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/sessions — list all sessions (newest first, no messages)
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await Session.find({}, { messages: 0 }).sort({ updatedAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions — create new session
app.post('/api/sessions', async (req, res) => {
  try {
    const session = new Session({ title: req.body.title || 'New Conversation' });
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id — get one session with messages
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sessions/:id — update title
app.patch('/api/sessions/:id', async (req, res) => {
  try {
    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { title: req.body.title, updatedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id — delete session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await Session.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat — send message, stream Groq response, save both to MongoDB
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  try {
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Save user message first
    session.messages.push({ role: 'user', content: message });
    await session.save();

    // Build history for Groq
    const history = session.messages.slice(0, -1).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));

    // Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = await groq.chat.completions.create({
      model: 'groq/compound',
      messages: [
        { role: 'system', content: 'You are a helpful, concise, and intelligent AI assistant.' },
        ...history,
        { role: 'user', content: message },
      ],
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    });

    let fullText = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        fullText += delta;
        // Send chunk as SSE
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    // Save AI message to MongoDB
    session.messages.push({ role: 'ai', content: fullText });
    session.updatedAt = new Date();

    // Auto-title from first user message
    if (session.title === 'New Conversation' && session.messages.length <= 2) {
      session.title = message.trim().slice(0, 50) + (message.length > 50 ? '…' : '');
    }

    await session.save();

    // Signal end of stream
    res.write(`data: ${JSON.stringify({ done: true, title: session.title })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Chat error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
