const { connectDB } = require('./_db.js');

module.exports = async function handler(req, res) {
  const status = {
    env: {
      MONGO_URI:    process.env.MONGO_URI    ? '✅ set' : '❌ MISSING',
      GROQ_API_KEY: process.env.GROQ_API_KEY ? '✅ set' : '❌ MISSING',
    },
    mongodb: 'checking...',
    timestamp: new Date().toISOString(),
  };

  try {
    await connectDB();
    status.mongodb = '✅ connected';
    return res.status(200).json(status);
  } catch (err) {
    status.mongodb = '❌ ' + err.message;
    return res.status(500).json(status);
  }
};
