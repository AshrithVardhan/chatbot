// POST /api/sessions/:id/messages — append user+AI messages to a session
import { connectDB, Session } from '../../../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  await connectDB();

  const { id } = req.query;
  const { userMessage, aiMessage, title } = req.body;

  const session = await Session.findById(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.messages.push({ role: 'user',  content: userMessage });
  session.messages.push({ role: 'ai',    content: aiMessage   });
  if (title) session.title = title;

  await session.save();
  return res.status(200).json({ ok: true });
}
