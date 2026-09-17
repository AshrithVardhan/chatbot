import './style.css';

// ─── STATE ────────────────────────────────────────────────────────────────────
let isLoading        = false;
let currentSessionId = null;

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const messagesEl      = document.getElementById('messages');
const welcomeScreen   = document.getElementById('welcomeScreen');
const messagesWrapper = document.getElementById('messagesWrapper');
const messageInput    = document.getElementById('messageInput');
const sendBtn         = document.getElementById('sendBtn');
const charCount       = document.getElementById('charCount');
const chatHistoryEl   = document.getElementById('chatHistory');
const chatTitle       = document.getElementById('chatTitle');
const clearBtn        = document.getElementById('clearBtn');
const newChatBtn      = document.getElementById('newChatBtn');
const toastEl         = document.getElementById('toast');
const sidebar         = document.getElementById('sidebar');
const sidebarOpen     = document.getElementById('sidebarOpen');
const sidebarClose    = document.getElementById('sidebarClose');

// ─── API HELPERS ──────────────────────────────────────────────────────────────
const api = {
  getSessions:    ()         => fetch('/api/sessions').then(r => r.json()),
  createSession:  (title)    => fetch('/api/sessions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title }) }).then(r => r.json()),
  getSession:     (id)       => fetch(`/api/sessions/${id}`).then(r => r.json()),
  deleteSession:  (id)       => fetch(`/api/sessions/${id}`, { method: 'DELETE' }),
  updateTitle:    (id, title)=> fetch(`/api/sessions/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title }) }).then(r => r.json()),
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadSessions();
  await startNewSession();
  messageInput.focus();
}

// ─── SESSION MANAGEMENT ───────────────────────────────────────────────────────
async function loadSessions() {
  try {
    const sessions = await api.getSessions();
    renderChatHistory(sessions);
  } catch (err) {
    showToast('Could not reach server — is it running?', 'error');
  }
}

async function startNewSession() {
  try {
    const session = await api.createSession('New Conversation');
    currentSessionId = session._id;
    clearMessages();
    chatTitle.textContent = 'New Conversation';
    await loadSessions();
  } catch (err) {
    showToast('Failed to create session', 'error');
  }
}

async function loadSession(id) {
  if (isLoading || id === currentSessionId) return;
  try {
    const session = await api.getSession(id);
    currentSessionId = session._id;

    messagesEl.innerHTML = '';
    if (!session.messages || session.messages.length === 0) {
      messagesEl.appendChild(welcomeScreen);
      welcomeScreen.style.display = 'flex';
    } else {
      welcomeScreen.style.display = 'none';
      session.messages.forEach(msg => {
        const { wrapper } = createMessageEl(msg.role, msg.content);
        messagesEl.appendChild(wrapper);
      });
    }

    chatTitle.textContent = session.title;
    await loadSessions();
    scrollToBottom();
    sidebar.classList.remove('open');
    messageInput.focus();
  } catch (err) {
    showToast('Failed to load session', 'error');
  }
}

function clearMessages() {
  messagesEl.innerHTML = '';
  messagesEl.appendChild(welcomeScreen);
  welcomeScreen.style.display = 'flex';
}

// ─── MARKDOWN RENDERER ────────────────────────────────────────────────────────
function renderMarkdown(text) {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang || 'plaintext'}">${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g,       (_, c)  => `<code>${escapeHtml(c)}</code>`)
    .replace(/\*\*(.+?)\*\*/g,   '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,       '<em>$1</em>')
    .replace(/^### (.+)$/gm,     '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,      '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,       '<h1>$1</h1>')
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^\d+\. (.+)$/gm,   '<li>$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^---$/gm,          '<hr>')
    .replace(/\n{2,}/g,          '</p><p>')
    .replace(/^(?!<[hup]|<li|<hr|<pre)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g,        '');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── MESSAGE RENDERING ────────────────────────────────────────────────────────
function createMessageEl(role, content, isStreaming = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === 'user' ? 'U' : '⚡';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (isStreaming) {
    bubble.classList.add('stream-cursor');
  } else {
    bubble.innerHTML = role === 'ai' ? renderMarkdown(content) : escapeHtml(content);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  return { wrapper, bubble };
}

function addTypingIndicator() {
  welcomeScreen.style.display = 'none';
  const wrapper = document.createElement('div');
  wrapper.className = 'message ai';
  wrapper.id = 'typingIndicator';
  wrapper.innerHTML = `
    <div class="avatar ai">⚡</div>
    <div class="bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function scrollToBottom() {
  requestAnimationFrame(() => { messagesWrapper.scrollTop = messagesWrapper.scrollHeight; });
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
async function sendMessage(text) {
  if (!text.trim() || isLoading || !currentSessionId) return;

  isLoading = true;
  setInputState(false);
  welcomeScreen.style.display = 'none';

  // User bubble
  const { wrapper: userWrapper } = createMessageEl('user', text.trim());
  messagesEl.appendChild(userWrapper);
  scrollToBottom();

  const indicator = addTypingIndicator();

  try {
    // POST to backend — response is SSE stream
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSessionId, message: text.trim() }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Server error');
    }

    indicator.remove();

    const { wrapper, bubble } = createMessageEl('ai', '', true);
    messagesEl.appendChild(wrapper);
    scrollToBottom();

    // Read SSE stream
    const reader   = response.body.getReader();
    const decoder  = new TextDecoder();
    let   fullText = '';
    let   buffer   = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.error) throw new Error(payload.error);
          if (payload.delta) {
            fullText += payload.delta;
            bubble.innerHTML = renderMarkdown(fullText);
            scrollToBottom();
          }
          if (payload.done) {
            bubble.classList.remove('stream-cursor');
            bubble.innerHTML = renderMarkdown(fullText);
            // Update title if server auto-titled
            if (payload.title && payload.title !== 'New Conversation') {
              chatTitle.textContent = payload.title;
            }
            await loadSessions(); // refresh sidebar
          }
        } catch (parseErr) {
          // ignore parse errors on incomplete chunks
        }
      }
    }

  } catch (err) {
    indicator.remove();
    console.error('Chat error:', err);
    const { wrapper } = createMessageEl('ai', '');
    wrapper.querySelector('.bubble').innerHTML =
      `<span style="color:#fca5a5;">⚠ ${escapeHtml(err.message || 'An error occurred.')}</span>`;
    messagesEl.appendChild(wrapper);
    scrollToBottom();
    showToast('Error: ' + err.message, 'error');
  } finally {
    isLoading = false;
    setInputState(true);
    messageInput.focus();
  }
}

// ─── INPUT HANDLING ───────────────────────────────────────────────────────────
function setInputState(enabled) {
  messageInput.disabled = !enabled;
  sendBtn.disabled = !enabled || !messageInput.value.trim();
  if (!enabled) {
    sendBtn.classList.add('loading');
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>`;
  } else {
    sendBtn.classList.remove('loading');
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  }
}

function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
  sendBtn.disabled = isLoading || !messageInput.value.trim();
  charCount.textContent = messageInput.value.length > 0 ? `${messageInput.value.length}` : '';
}

messageInput.addEventListener('input', autoResizeTextarea);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const val = messageInput.value.trim();
    if (val && !isLoading) {
      messageInput.value = '';
      autoResizeTextarea();
      sendMessage(val);
    }
  }
});

sendBtn.addEventListener('click', () => {
  const val = messageInput.value.trim();
  if (val && !isLoading) {
    messageInput.value = '';
    autoResizeTextarea();
    sendMessage(val);
  }
});

// Suggestion cards
document.querySelectorAll('.suggestion-card').forEach(card => {
  card.addEventListener('click', () => {
    const prompt = card.dataset.prompt;
    messageInput.value = '';
    autoResizeTextarea();
    sendMessage(prompt);
  });
});

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
sidebarOpen.addEventListener('click',  () => sidebar.classList.add('open'));
sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 &&
      sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      e.target !== sidebarOpen) {
    sidebar.classList.remove('open');
  }
});

// ─── NEW CHAT / CLEAR ─────────────────────────────────────────────────────────
newChatBtn.addEventListener('click', async () => {
  if (isLoading) return;
  await startNewSession();
  sidebar.classList.remove('open');
  messageInput.focus();
});

clearBtn.addEventListener('click', async () => {
  if (isLoading || !currentSessionId) return;
  try {
    await api.deleteSession(currentSessionId);
    showToast('Chat deleted', 'success');
    await startNewSession();
  } catch (err) {
    showToast('Failed to delete chat', 'error');
  }
});

// ─── CHAT HISTORY RENDERING ───────────────────────────────────────────────────
function renderChatHistory(sessions) {
  chatHistoryEl.innerHTML = '';
  if (!sessions || sessions.length === 0) {
    chatHistoryEl.innerHTML = `<p style="color:var(--text-muted);font-size:12px;padding:8px 12px;">No conversations yet</p>`;
    return;
  }
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = `history-item${s._id === currentSessionId ? ' active' : ''}`;
    item.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.5">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      <span title="${escapeHtml(s.title)}">${escapeHtml(s.title)}</span>`;
    item.addEventListener('click', () => loadSession(s._id));
    chatHistoryEl.appendChild(item);
  });
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = '') {
  toastEl.textContent = msg;
  toastEl.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 3500);
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
init();
