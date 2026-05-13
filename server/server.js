require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// In-memory storage (replace with MongoDB/PostgreSQL in production)
const rooms = new Map();
const users = new Map();
const userSockets = new Map();

// Default room
rooms.set('default', {
  id: 'default',
  name: 'Welcome Project',
  description: 'A demo project to get you started with DevCollab',
  owner: 'system',
  files: {
    'index.html': {
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevCollab Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app">
    <header>
      <h1>Hello DevCollab</h1>
      <p>Real-time collaborative coding</p>
    </header>
    <main>
      <div class="card">
        <h2>Features</h2>
        <ul>
          <li>Live collaboration</li>
          <li>Multi-cursor editing</li>
          <li>Instant preview</li>
          <li>Project rooms</li>
        </ul>
        <button id="actionBtn">Get Started</button>
      </div>
    </main>
  </div>
  <script src="app.js"><\/script>
</body>
</html>`,
      type: 'html',
      version: 1
    },
    'style.css': {
      content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg: #0d1117;
  --surface: #161b22;
  --border: #30363d;
  --text: #c9d1d9;
  --text-secondary: #8b949e;
  --accent: #58a6ff;
  --accent-hover: #79b8ff;
  --success: #238636;
  --warning: #d29922;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  line-height: 1.6;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
}

header {
  text-align: center;
  margin-bottom: 48px;
}

header h1 {
  font-size: 48px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--accent), #a371f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 12px;
}

header p {
  color: var(--text-secondary);
  font-size: 18px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 32px;
}

.card h2 {
  font-size: 24px;
  margin-bottom: 20px;
  color: var(--text);
}

.card ul {
  list-style: none;
  margin-bottom: 28px;
}

.card li {
  padding: 10px 0;
  padding-left: 28px;
  position: relative;
  color: var(--text-secondary);
}

.card li::before {
  content: "→";
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: bold;
}

#actionBtn {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 14px 32px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

#actionBtn:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
}`,
      type: 'css',
      version: 1
    },
    'app.js': {
      content: `const btn = document.getElementById('actionBtn');
let clicks = 0;

btn.addEventListener('click', () => {
  clicks++;
  btn.textContent = clicks === 1 ? 'Clicked once!' : \`Clicked \${clicks} times!\`;
  btn.style.background = clicks % 2 === 0 ? '#a371f7' : '#58a6ff';
  console.log('Button clicked:', clicks);
});

// Welcome message
console.log('%c DevCollab ', 'background: #58a6ff; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
console.log('Welcome to collaborative coding!');`,
      type: 'js',
      version: 1
    },
    'README.md': {
      content: `# DevCollab Project

Welcome to your collaborative workspace!

## Quick Start

1. Edit files in the code editor
2. See changes instantly in the preview
3. Chat with your team in real-time
4. Vote on features to prioritize

## Team

- You (Owner)
- Invite others to collaborate

## Features

- Real-time multi-cursor editing
- Syntax highlighting (Monaco Editor)
- Live preview with auto-reload
- Project rooms with descriptions
- Feature voting system
- Team presence indicators`,
      type: 'markdown',
      version: 1
    }
  },
  messages: [
    { id: '1', user: 'DevCollab Bot', text: 'Welcome to your new project! Start coding and invite your team.', color: '#58a6ff', time: Date.now() }
  ],
  features: [
    { id: '1', title: 'Add TypeScript support', desc: 'Enable .ts files with type checking', votes: 5, upvotedBy: new Set(['user1']), author: 'Sarah Chen', time: '2h ago' },
    { id: '2', title: 'Dark theme for editor', desc: 'VS Code dark theme in the code editor', votes: 12, upvotedBy: new Set(['user1', 'user2']), author: 'Alex Rivera', time: '5h ago' },
    { id: '3', title: 'Git integration', desc: 'Push/pull from GitHub repositories', votes: 8, upvotedBy: new Set([]), author: 'Mike Park', time: '1d ago' }
  ],
  createdAt: Date.now()
});

// API Routes
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    owner: r.owner,
    userCount: Array.from(users.values()).filter(u => u.roomId === r.id).length,
    createdAt: r.createdAt
  }));
  res.json(roomList);
});

app.post('/api/rooms', (req, res) => {
  const { name, description, owner } = req.body;
  const id = uuidv4();
  const room = {
    id,
    name,
    description: description || 'No description',
    owner: owner || 'anonymous',
    files: {
      'index.html': {
        content: '<!DOCTYPE html>\n<html>\n<head><title>' + name + '</title></head>\n<body>\n  <h1>' + name + '</h1>\n  <p>' + description + '</p>\n</body>\n</html>',
        type: 'html',
        version: 1
      }
    },
    messages: [],
    features: [],
    createdAt: Date.now()
  };
  rooms.set(id, room);
  res.json({ id, name, description });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({
    id: room.id,
    name: room.name,
    description: room.description,
    owner: room.owner,
    files: room.files,
    messages: room.messages,
    features: room.features.map(f => ({ ...f, upvotedBy: undefined, votes: f.votes })),
    createdAt: room.createdAt
  });
});

app.get('/api/turn-credentials', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:global.turn.twilio.com:3478?transport=udp',
        username: process.env.TWILIO_ACCOUNT_SID,
        credential: process.env.TWILIO_AUTH_TOKEN
      }
    ]
  });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, username, color }) => {
    socket.join(roomId);
    const user = { id: socket.id, username, color, roomId, cursor: null, selection: null };
    users.set(socket.id, user);
    userSockets.set(socket.id, socket);

    const room = rooms.get(roomId);
    if (room) {
      socket.emit('room-data', {
        files: room.files,
        messages: room.messages,
        features: room.features.map(f => ({ ...f, upvotedBy: undefined, votes: f.votes }))
      });

      // Notify others
      socket.to(roomId).emit('user-joined', {
        id: socket.id,
        username,
        color
      });

      // Send current users in room
      const roomUsers = Array.from(users.values())
        .filter(u => u.roomId === roomId)
        .map(u => ({ id: u.id, username: u.username, color: u.color }));
      socket.emit('users-list', roomUsers);
    }
  });

  socket.on('code-change', ({ roomId, filename, content, version }) => {
    const room = rooms.get(roomId);
    if (room && room.files[filename]) {
      room.files[filename].content = content;
      room.files[filename].version = version;
      socket.to(roomId).emit('code-update', { filename, content, version, userId: socket.id });
    }
  });

  socket.on('cursor-move', ({ roomId, filename, cursor, selection }) => {
    const user = users.get(socket.id);
    if (user) {
      user.cursor = cursor;
      user.selection = selection;
      socket.to(roomId).emit('cursor-update', {
        userId: socket.id,
        username: user.username,
        color: user.color,
        filename,
        cursor,
        selection
      });
    }
  });

  socket.on('chat-message', ({ roomId, text }) => {
    const user = users.get(socket.id);
    if (user && room) {
      const msg = {
        id: uuidv4(),
        user: user.username,
        text,
        color: user.color,
        time: Date.now()
      };
      room.messages.push(msg);
      if (room.messages.length > 100) room.messages.shift();
      io.to(roomId).emit('new-message', msg);
    }
  });

  socket.on('feature-vote', ({ roomId, featureId, upvote }) => {
    const room = rooms.get(roomId);
    if (room) {
      const feature = room.features.find(f => f.id === featureId);
      if (feature) {
        if (upvote) {
          feature.upvotedBy.add(socket.id);
          feature.votes = feature.upvotedBy.size;
        } else {
          feature.upvotedBy.delete(socket.id);
          feature.votes = feature.upvotedBy.size;
        }
        io.to(roomId).emit('feature-updated', { id: featureId, votes: feature.votes });
      }
    }
  });

  socket.on('add-feature', ({ roomId, title, desc }) => {
    const room = rooms.get(roomId);
    if (room) {
      const feature = {
        id: uuidv4(),
        title,
        desc: desc || 'No description',
        votes: 1,
        upvotedBy: new Set([socket.id]),
        author: users.get(socket.id)?.username || 'Anonymous',
        time: 'Just now'
      };
      room.features.unshift(feature);
      io.to(roomId).emit('feature-added', { ...feature, upvotedBy: undefined, votes: feature.votes });
    }
  });

  socket.on('create-file', ({ roomId, filename }) => {
    const room = rooms.get(roomId);
    if (room && !room.files[filename]) {
      room.files[filename] = { content: '', type: getFileType(filename), version: 1 };
      io.to(roomId).emit('file-created', { filename, file: room.files[filename] });
    }
  });

  socket.on('delete-file', ({ roomId, filename }) => {
    const room = rooms.get(roomId);
    if (room && room.files[filename]) {
      delete room.files[filename];
      io.to(roomId).emit('file-deleted', { filename });
    }
  });

  socket.on('rename-file', ({ roomId, oldName, newName }) => {
    const room = rooms.get(roomId);
    if (room && room.files[oldName] && !room.files[newName]) {
      room.files[newName] = room.files[oldName];
      delete room.files[oldName];
      io.to(roomId).emit('file-renamed', { oldName, newName });
    }
  });

  
  // WebRTC Signaling
  socket.on('webrtc-offer', ({ roomId, targetId, offer }) => {
    socket.to(targetId).emit('webrtc-offer', { fromId: socket.id, offer });
  });

  socket.on('webrtc-answer', ({ roomId, targetId, answer }) => {
    socket.to(targetId).emit('webrtc-answer', { fromId: socket.id, answer });
  });

  socket.on('webrtc-ice', ({ roomId, targetId, candidate }) => {
    socket.to(targetId).emit('webrtc-ice', { fromId: socket.id, candidate });
  });

  socket.on('mic-state', ({ roomId, enabled }) => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(roomId).emit('mic-state', { 
        userId: socket.id, 
        enabled, 
        username: user.username 
      });
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(user.roomId).emit('user-left', { id: socket.id, username: user.username });
      users.delete(socket.id);
      userSockets.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['js','ts','jsx','mjs'].includes(ext)) return 'javascript';
  if (['css','scss','less'].includes(ext)) return 'css';
  if (['html','htm'].includes(ext)) return 'html';
  if (['json'].includes(ext)) return 'json';
  if (['md','txt'].includes(ext)) return 'markdown';
  return 'plaintext';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('DevCollab server running on port ' + PORT);
});
