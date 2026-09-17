const { connectDB, Session } = require('../../../_db.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  try {
    await connectDB();
  } catch (err) {
    return res.status(500).json({ error: 'DB connection failed: ' + err.message });
  }

  try {
    const { id } = req.query;
    const { userMessage, aiMessage, title } = req.body;

    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.messages.push({ role: 'user', content: userMessage });
    session.messages.push({ role: 'ai',   content: aiMessage   });
    if (title) session.title = title;

    await session.save();
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
