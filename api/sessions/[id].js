const { connectDB, Session } = require('../../_db.js');

module.exports = async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    return res.status(500).json({ error: 'DB connection failed: ' + err.message });
  }

  try {
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
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
