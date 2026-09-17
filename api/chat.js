// POST /api/chat — streams Groq response back via SSE
// Uses Edge Runtime for proper streaming support on Vercel
export const config = { runtime: 'edge' };

import Groq from 'groq-sdk';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { sessionId, message } = await req.json();
  if (!sessionId || !message) {
    return new Response(JSON.stringify({ error: 'sessionId and message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch session from our own API (edge → serverless)
  const baseUrl = req.url.replace(/\/api\/chat.*/, '');
  const sessionRes = await fetch(`${baseUrl}/api/sessions/${sessionId}`);
  if (!sessionRes.ok) {
    return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
  }
  const session = await sessionRes.json();

  // Build history for Groq
  const history = (session.messages || []).map(m => ({
    role: m.role === 'ai' ? 'assistant' : 'user',
    content: m.content,
  }));

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let fullText = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const groqStream = await groq.chat.completions.create({
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

        for await (const chunk of groqStream) {
          const delta = chunk.choices[0]?.delta?.content ?? '';
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
        }

        // Auto-title logic
        let title = session.title;
        if (title === 'New Conversation') {
          title = message.trim().slice(0, 50) + (message.length > 50 ? '…' : '');
        }

        // Save user message + AI response + title to DB via sessions API
        await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });

        // Save messages via a dedicated save endpoint
        await fetch(`${baseUrl}/api/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage: message, aiMessage: fullText, title }),
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, title })}\n\n`));
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
