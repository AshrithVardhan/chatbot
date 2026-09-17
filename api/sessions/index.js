const { connectDB, Session } = require('../_db.js');

module.exports = async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    return res.status(500).json({ error: 'DB connection failed: ' + err.message });
  }

  try {
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
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
