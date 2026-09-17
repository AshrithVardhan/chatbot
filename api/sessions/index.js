// GET  /api/sessions  → list all sessions
// POST /api/sessions  → create new session
import { connectDB, Session } from '../_db.js';

export default async function handler(req, res) {
  await connectDB();

  if (req.method === 'GET') {
    const sessions = await Session.find({}, { messages: 0 }).sort({ updatedAt: -1 });
    return res.status(200).json(sessions);
  }

  if (req.method === 'POST') {
    const session = new Session({ title: req.body.title || 'New Conversation' });
    await session.save();
    return res.status(201).json(session);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
