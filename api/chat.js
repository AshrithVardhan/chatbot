const Groq   = require('groq-sdk');
const { connectDB, Session } = require('./_db.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  try {
    await connectDB();
  } catch (err) {
    return res.status(500).json({ error: 'DB connection failed: ' + err.message });
  }

  try {
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Save user message first
    session.messages.push({ role: 'user', content: message });
    await session.save();

    // Build history for Groq (all previous messages)
    const history = session.messages.slice(0, -1).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));

    // Set up SSE streaming headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    // Auto-title from first message
    let title = session.title;
    if (title === 'New Conversation') {
      title = message.trim().slice(0, 50) + (message.length > 50 ? '…' : '');
    }

    // Save AI reply + title
    session.messages.push({ role: 'ai', content: fullText });
    session.title = title;
    session.updatedAt = new Date();
    await session.save();

    res.write(`data: ${JSON.stringify({ done: true, title })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Chat error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};
