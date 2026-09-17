# MongoDB Backend Integration Plan

## Architecture
- **Backend**: Express.js server with mongoose + groq-sdk
- **Frontend**: Calls backend API (no direct Groq or MongoDB access from browser)
- **MongoDB**: Stores sessions and messages persistently

## New File Structure
```
chatbot/
├── server/
│   ├── index.js          # Express server entry
│   ├── db.js             # MongoDB connection
│   └── models/
│       └── Session.js    # Session + Message schema
├── src/
│   ├── main.js           # Frontend (updated to call API)
│   └── style.css
├── vite.config.js        # Proxy /api → Express
└── package.json          # Add server deps
```

## API Endpoints
- GET  /api/sessions         → list all sessions
- POST /api/sessions         → create new session
- GET  /api/sessions/:id     → get session with messages
- DELETE /api/sessions/:id   → delete session
- POST /api/chat             → send message (streams Groq response back)
