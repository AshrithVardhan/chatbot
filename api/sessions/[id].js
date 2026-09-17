// GET    /api/sessions/:id  → get one session with messages
// PATCH  /api/sessions/:id  → update title
// DELETE /api/sessions/:id  → delete session
import { connectDB, Session } from '../../_db.js';

export default async function handler(req, res) {
  await connectDB();

  const { id } = req.query;

  if (req.method === 'GET') {
    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.status(200).json(session);
  }

  if (req.method === 'PATCH') {
    const session = await Session.findByIdAndUpdate(
      id,
      { title: req.body.title, updatedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.status(200).json(session);
  }

  if (req.method === 'DELETE') {
    await Session.findByIdAndDelete(id);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
