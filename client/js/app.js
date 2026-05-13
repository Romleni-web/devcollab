const ICONS = {
  file: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
  js: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm4.5 14.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-3h-1.5v3H7.5v-5.5H6v5.5h1.5zm5.5 0v-1.5h3v-1.5h-3V9h4.5v1.5h-3v1.5h3v3H12z"/></svg>',
  css: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm4.5 14.5v-1.5h3v-1.5h-3V9h4.5v1.5h-3v1.5h3v3H7.5zm5.5 0v-1.5h3v-1.5h-3V9h4.5v1.5h-3v1.5h3v3H13z"/></svg>',
  html: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm4.5 14.5v-1.5h3v-1.5h-3V9h4.5v1.5h-3v1.5h3v3H7.5zm5.5 0v-1.5h3v-1.5h-3V9h4.5v1.5h-3v1.5h3v3H13z"/></svg>',
  md: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
};

const state = {
  currentUser: null,
  currentRoom: null,
  files: {},
  openTabs: [],
  activeTab: null,
  unsaved: new Set(),
  features: [],
  roomUsers: [],
  editor: null,
  socket: null,
  ctxFile: null,
  currentView: 'code'
};

let turnCredentials = null;
let localStream = null;
let peerConnections = {};
let micEnabled = false;
let audioContext = null;
let analyser = null;
let dataArray = null;

require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});

let monacoReady = false;
require(['vs/editor/editor.main'], function() {
  monacoReady = true;
  monaco.editor.defineTheme('devcollab-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'identifier', foreground: '9CDCFE' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'tag', foreground: '569CD6' },
      { token: 'attribute.name', foreground: '9CDCFE' },
      { token: 'attribute.value', foreground: 'CE9178' }
    ],
    colors: {
      'editor.background': '#0d1117',
      'editor.lineHighlightBackground': '#161b22',
      'editorLineNumber.foreground': '#484f58',
      'editorLineNumber.activeForeground': '#c9d1d9',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#264f7855'
    }
  });
});

function init() {
  const saved = localStorage.getItem('devcollab_user');
  if (saved) {
    state.currentUser = JSON.parse(saved);
    showRoomScreen();
  }
}

function enterApp() {
  const username = document.getElementById('usernameInput').value.trim();
  const color = document.getElementById('colorInput').value;
  if (!username) { showToast('Please enter your name'); return; }
  state.currentUser = { username, color };
  localStorage.setItem('devcollab_user', JSON.stringify(state.currentUser));
  showRoomScreen();
}

function showRoomScreen() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('roomScreen').style.display = 'flex';
  document.getElementById('currentUserName').textContent = state.currentUser.username;
  document.getElementById('currentUserDot').style.background = state.currentUser.color;
  loadRooms();
}

function showAppScreen() {
  document.getElementById('roomScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'flex';
}

function backToRooms() {
  if (state.socket) state.socket.disconnect();
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('roomScreen').style.display = 'flex';
  loadRooms();
}

async function loadRooms() {
  try {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    renderRooms(rooms);
  } catch (e) {
    renderRooms([
      { id: 'default', name: 'Welcome Project', description: 'A demo project to get you started', owner: 'system', userCount: 3 },
      { id: 'demo1', name: 'React Dashboard', description: 'Admin dashboard with charts and tables', owner: 'Sarah', userCount: 2 },
      { id: 'demo2', name: 'API Server', description: 'Node.js REST API with authentication', owner: 'Alex', userCount: 1 }
    ]);
  }
}

function renderRooms(rooms) {
  const container = document.getElementById('roomsList');
  container.innerHTML = rooms.map(r => `
    <div class="room-card" onclick="joinRoom('${r.id}')">
      <h3>${escapeHtml(r.name)}</h3>
      <p>${escapeHtml(r.description)}</p>
      <div class="room-card-meta">
        <span>by ${escapeHtml(r.owner)}</span>
        <div class="room-users">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          ${r.userCount}
        </div>
      </div>
    </div>
  `).join('');
}

function showCreateRoom() {
  document.getElementById('createRoomModal').classList.add('active');
  document.getElementById('roomNameInput').focus();
}

function closeCreateRoom() {
  document.getElementById('createRoomModal').classList.remove('active');
  document.getElementById('roomNameInput').value = '';
  document.getElementById('roomDescInput').value = '';
}

async function createRoom() {
  const name = document.getElementById('roomNameInput').value.trim();
  const desc = document.getElementById('roomDescInput').value.trim();
  if (!name) { showToast('Please enter a project name'); return; }
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: desc, owner: state.currentUser.username })
    });
    const room = await res.json();
    closeCreateRoom();
    joinRoom(room.id);
  } catch (e) { showToast('Failed to create project'); }
}

async function getTurnCredentials() {
  if (turnCredentials) return turnCredentials;
  try {
    const res = await fetch('/api/turn-credentials');
    turnCredentials = await res.json();
    return turnCredentials;
  } catch (e) {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }
}

function joinRoom(roomId) {
  state.currentRoom = roomId;
  showAppScreen();
  document.getElementById('projectName').textContent = 'Loading...';

  state.socket = io();

  state.socket.on('connect', () => {
    state.socket.emit('join-room', {
      roomId, username: state.currentUser.username, color: state.currentUser.color
    });
  });

  state.socket.on('room-data', (data) => {
    state.files = data.files;
    state.features = data.features || [];
    renderFileTree();
    renderFeatures();
    renderChatMessages(data.messages || []);
    const firstFile = Object.keys(state.files)[0];
    if (firstFile) openFile(firstFile);
    if (monacoReady) initMonaco();
    else setTimeout(initMonaco, 500);
  });

  state.socket.on('users-list', (users) => {
    state.roomUsers = users.filter(u => u.id !== state.socket.id);
    renderTeam();
    renderCollaborators();
    renderAudioIndicators();
  });

  state.socket.on('user-joined', (user) => {
    showToast(user.username + ' joined');
    if (micEnabled) setTimeout(() => createPeerConnection(user.id, true), 500);
  });

  state.socket.on('user-left', (user) => {
    showToast(user.username + ' left');
    state.roomUsers = state.roomUsers.filter(u => u.id !== user.id);
    if (peerConnections[user.id]) {
      peerConnections[user.id].close();
      delete peerConnections[user.id];
    }
    const audio = document.getElementById('audio-' + user.id);
    if (audio) audio.remove();
    renderTeam();
    renderCollaborators();
    renderAudioIndicators();
  });

  state.socket.on('code-update', ({ filename, content }) => {
    if (state.files[filename]) {
      state.files[filename].content = content;
      if (state.activeTab === filename && state.editor) {
        const model = state.editor.getModel();
        if (model && model.getValue() !== content) model.setValue(content);
      }
    }
  });

  state.socket.on('new-message', (msg) => { addChatMessage(msg); });
  state.socket.on('feature-added', (feature) => { state.features.unshift(feature); renderFeatures(); });
  state.socket.on('feature-updated', ({ id, votes }) => {
    const f = state.features.find(x => x.id === id);
    if (f) f.votes = votes;
    renderFeatures();
  });
  state.socket.on('file-created', ({ filename, file }) => { state.files[filename] = file; renderFileTree(); });
  state.socket.on('file-deleted', ({ filename }) => {
    delete state.files[filename];
    if (state.activeTab === filename) closeTab(null, filename);
    renderFileTree();
  });
  state.socket.on('file-renamed', ({ oldName, newName }) => {
    state.files[newName] = state.files[oldName];
    delete state.files[oldName];
    if (state.activeTab === oldName) state.activeTab = newName;
    const idx = state.openTabs.indexOf(oldName);
    if (idx > -1) state.openTabs[idx] = newName;
    renderFileTree();
    renderTabs();
  });

  // WebRTC signaling
  state.socket.on('webrtc-offer', ({ fromId, offer }) => { handleWebRTCOffer(fromId, offer); });
  state.socket.on('webrtc-answer', ({ fromId, answer }) => { handleWebRTCAnswer(fromId, answer); });
  state.socket.on('webrtc-ice', ({ fromId, candidate }) => { handleWebRTCIce(fromId, candidate); });
  state.socket.on('mic-state', ({ userId, enabled, username }) => {
    showToast(username + (enabled ? ' unmuted' : ' muted'));
  });

  fetch('/api/rooms/' + roomId)
    .then(r => r.json())
    .then(room => {
      document.getElementById('projectName').textContent = room.name;
      document.getElementById('projectDesc').textContent = room.description;
    })
    .catch(() => {
      document.getElementById('projectName').textContent = 'Project';
      document.getElementById('projectDesc').textContent = 'Collaborative workspace';
    });
}

function initMonaco() {
  if (!state.activeTab || !monacoReady) return;
  const container = document.getElementById('monacoEditor');
  container.innerHTML = '';
  const file = state.files[state.activeTab];
  if (!file) return;
  const language = getMonacoLanguage(state.activeTab);

  state.editor = monaco.editor.create(container, {
    value: file.content,
    language: language,
    theme: 'devcollab-dark',
    fontSize: 14,
    fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
    lineNumbers: 'on',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    minimap: { enabled: true },
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    folding: true,
    renderLineHighlight: 'all',
    selectOnLineNumbers: true,
    matchBrackets: 'always',
    autoIndent: 'full',
    formatOnPaste: true,
    formatOnType: true
  });

  state.editor.onDidChangeModelContent(() => {
    const content = state.editor.getValue();
    state.files[state.activeTab].content = content;
    state.unsaved.add(state.activeTab);
    renderTabs();
    if (state.socket) {
      state.socket.emit('code-change', {
        roomId: state.currentRoom,
        filename: state.activeTab,
        content: content,
        version: (state.files[state.activeTab].version || 0) + 1
      });
    }
    if (state.currentView === 'preview') loadPreview();
  });

  state.editor.onDidChangeCursorPosition((e) => {
    if (state.socket) {
      state.socket.emit('cursor-move', {
        roomId: state.currentRoom,
        filename: state.activeTab,
        cursor: { line: e.position.lineNumber, column: e.position.column }
      });
    }
  });
}

function getMonacoLanguage(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript',
    'html': 'html', 'css': 'css', 'json': 'json',
    'md': 'markdown', 'py': 'python', 'java': 'java',
    'cpp': 'cpp', 'c': 'c', 'go': 'go', 'rs': 'rust',
    'php': 'php', 'rb': 'ruby', 'sql': 'sql', 'xml': 'xml',
    'yaml': 'yaml', 'sh': 'shell'
  };
  return map[ext] || 'plaintext';
}

function renderFileTree() {
  const tree = document.getElementById('fileTree');
  tree.innerHTML = '';
  Object.keys(state.files).sort().forEach(f => {
    const div = document.createElement('div');
    div.className = 'file-item' + (f === state.activeTab ? ' active' : '');
    div.innerHTML = getFileIcon(f) + '<span>' + escapeHtml(f) + '</span>';
    div.onclick = () => openFile(f);
    div.oncontextmenu = (e) => { e.preventDefault(); showCtx(e, f); };
    tree.appendChild(div);
  });
}

function renderTabs() {
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = '';
  state.openTabs.forEach(t => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (t === state.activeTab ? ' active' : '');
    const unsaved = state.unsaved.has(t) ? '<span class="unsaved"></span>' : '';
    tab.innerHTML = unsaved + escapeHtml(t) + '<span class="close" onclick="closeTab(event, \'' + t + '\')"><svg viewBox="0 0 24 24" width="10" height="10"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>';
    tab.onclick = (e) => { if (!e.target.closest('.close')) openFile(t); };
    tabsEl.appendChild(tab);
  });
}

function openFile(name) {
  if (!state.files[name]) return;
  if (!state.openTabs.includes(name)) state.openTabs.push(name);
  state.activeTab = name;
  renderFileTree();
  renderTabs();
  if (monacoReady && state.editor) {
    const language = getMonacoLanguage(name);
    const model = monaco.editor.createModel(state.files[name].content, language);
    state.editor.setModel(model);
  } else if (!monacoReady) {
    setTimeout(() => openFile(name), 200);
  }
}

function closeTab(e, name) {
  if (e) e.stopPropagation();
  state.openTabs = state.openTabs.filter(t => t !== name);
  state.unsaved.delete(name);
  if (state.activeTab === name) {
    state.activeTab = state.openTabs[0] || null;
    if (state.activeTab) openFile(state.activeTab);
    else if (state.editor) state.editor.setValue('');
  }
  renderTabs();
  renderFileTree();
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'mjs') return ICONS.js;
  if (ext === 'css' || ext === 'scss' || ext === 'less') return ICONS.css;
  if (ext === 'html' || ext === 'htm') return ICONS.html;
  if (ext === 'md' || ext === 'txt') return ICONS.md;
  return ICONS.file;
}

function renderTeam() {
  const container = document.getElementById('teamAvatars');
  const allUsers = [{ ...state.currentUser, id: 'me' }, ...state.roomUsers];
  container.innerHTML = allUsers.map(u => `
    <div class="team-avatar" style="background: ${u.color}" title="${escapeHtml(u.username)}">
      ${u.username.charAt(0).toUpperCase()}
    </div>
  `).join('');
}

function renderCollaborators() {
  const container = document.getElementById('collaborators');
  const allUsers = [
    { ...state.currentUser, id: 'me', status: 'You' },
    ...state.roomUsers.map(u => ({ ...u, status: 'Online' }))
  ];
  container.innerHTML = allUsers.map(u => `
    <div class="collab-user">
      <div class="dot" style="background: ${u.color}"></div>
      <span class="name">${escapeHtml(u.username)}</span>
      <span class="status">${u.status}</span>
    </div>
  `).join('');
  document.getElementById('teamCount').textContent = allUsers.length;
}

function renderFeatures() {
  const container = document.getElementById('featuresList');
  container.innerHTML = state.features.map((f) => `
    <div class="feature-card">
      <h4>${escapeHtml(f.title)}</h4>
      <p>${escapeHtml(f.desc)}</p>
      <div class="votes">
        <button class="vote-btn ${f.upvoted ? 'active' : ''}" onclick="voteFeature('${f.id}')">
          <svg viewBox="0 0 24 24" width="12" height="12"><path d="M7 14l5-5 5 5z"/></svg>
          ${f.votes}
        </button>
        <span class="feature-meta">by ${escapeHtml(f.author)} \u00B7 ${f.time}</span>
      </div>
    </div>
  `).join('');
}

function voteFeature(id) {
  const f = state.features.find(x => x.id === id);
  if (!f) return;
  const upvote = !f.upvoted;
  f.upvoted = upvote;
  f.votes += upvote ? 1 : -1;
  renderFeatures();
  if (state.socket) state.socket.emit('feature-vote', { roomId: state.currentRoom, featureId: id, upvote });
}

function addFeature() {
  const t = document.getElementById('featureTitle');
  const d = document.getElementById('featureDesc');
  if (!t.value.trim()) return;
  if (state.socket) state.socket.emit('add-feature', { roomId: state.currentRoom, title: t.value.trim(), desc: d.value.trim() });
  t.value = '';
  d.value = '';
}

function renderChatMessages(messages) {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  messages.forEach(m => addChatMessage(m));
}

function addChatMessage(msg) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  const isOwn = msg.user === state.currentUser?.username;
  const time = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.className = 'chat-msg' + (isOwn ? ' own' : '');
  div.innerHTML = `
    <div class="meta">
      <span class="user" style="color: ${msg.color || '#58a6ff'}">${escapeHtml(msg.user)}</span>
      <span class="time">${time}</span>
    </div>
    <div class="body">${escapeHtml(msg.text)}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !state.socket) return;
  state.socket.emit('chat-message', { roomId: state.currentRoom, text });
  input.value = '';
}

function toggleChat() {
  document.getElementById('chatPanel').classList.toggle('active');
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.header-nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + view).classList.add('active');
  document.getElementById('previewPanel').classList.toggle('active', view === 'preview');
  document.getElementById('featuresPanel').classList.toggle('active', view === 'features');
  if (view === 'preview') loadPreview();
}

function loadPreview() {
  const html = state.files['index.html']?.content || '<h1>No index.html</h1>';
  const css = state.files['style.css']?.content || '';
  const js = state.files['app.js']?.content || '';
  const cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  const consoleCaptureScript = `<script>
(function() {
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  function send(level, args) {
    try {
      const serialized = Array.from(args).map(arg => {
        if (arg instanceof Error) return arg.message + '\\n' + arg.stack;
        if (typeof arg === 'object') { try { return JSON.parse(JSON.stringify(arg)); } catch { return String(arg); } }
        return arg;
      });
      window.parent.postMessage({ type: 'console', level: level, args: serialized }, '*');
    } catch(e) {}
  }
  console.log = function() { send('log', arguments); orig.log.apply(console, arguments); };
  console.info = function() { send('info', arguments); orig.info.apply(console, arguments); };
  console.warn = function() { send('warn', arguments); orig.warn.apply(console, arguments); };
  console.error = function() { send('error', arguments); orig.error.apply(console, arguments); };
  console.debug = function() { send('debug', arguments); orig.debug.apply(console, arguments); };
  window.onerror = function(msg, url, line) { send('error', ['Uncaught: ' + msg + ' at line ' + line]); return false; };
  window.onunhandledrejection = function(e) { send('error', ['Unhandled Rejection: ' + e.reason]); };
})();
<\/script>`;

  const doc = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${css}</style></head>
<body>${cleanHtml}${consoleCaptureScript}<script>${js}<\/script></body>
</html>`;

  document.getElementById('previewFrame').srcdoc = doc;
  if (!document.getElementById('consolePanel').classList.contains('active')) {
    document.getElementById('consolePanel').classList.add('active');
    document.getElementById('consoleToggle').classList.add('hidden');
  }
}

function refreshPreview() {
  loadPreview();
  showToast('Preview refreshed');
}

function newFile() {
  const name = prompt('Enter filename:');
  if (name && !state.files[name]) {
    if (state.socket) state.socket.emit('create-file', { roomId: state.currentRoom, filename: name });
    else { state.files[name] = { content: '', type: 'plaintext' }; renderFileTree(); openFile(name); }
  }
}

function newFolder() { showToast('Folders coming soon'); }

function showCtx(e, f) {
  state.ctxFile = f;
  const menu = document.getElementById('contextMenu');
  menu.style.display = 'block';
  menu.style.left = e.pageX + 'px';
  menu.style.top = e.pageY + 'px';
}

function renameFile() {
  const old = state.ctxFile;
  const name = prompt('New name:', old);
  if (name && name !== old && !state.files[name]) {
    if (state.socket) state.socket.emit('rename-file', { roomId: state.currentRoom, oldName: old, newName: name });
  }
}

function deleteFile() {
  const f = state.ctxFile;
  if (confirm('Delete "' + f + '"?')) {
    if (state.socket) state.socket.emit('delete-file', { roomId: state.currentRoom, filename: f });
  }
}

function downloadFile() {
  const f = state.ctxFile;
  const blob = new Blob([state.files[f]?.content || ''], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = f;
  a.click();
  showToast('Downloaded ' + f);
}

function duplicateFile() {
  const f = state.ctxFile;
  const base = f.replace(/[.][^.]+$/, '');
  const ext = f.match(/[.][^.]+$/) ? f.match(/[.][^.]+$/)[0] : '';
  let newName = base + ' copy' + ext;
  let i = 2;
  while (state.files[newName]) { newName = base + ' copy ' + i + ext; i++; }
  state.files[newName] = { ...state.files[f] };
  renderFileTree();
  openFile(newName);
  showToast('Duplicated as ' + newName);
}

// Console panel
function toggleConsole() {
  const panel = document.getElementById('consolePanel');
  const toggle = document.getElementById('consoleToggle');
  panel.classList.toggle('active');
  toggle.classList.toggle('hidden');
}

function switchConsoleTab(tab) {
  document.querySelectorAll('.console-tab').forEach(t => t.classList.remove('active'));
  event.target.closest('.console-tab').classList.add('active');
}

function clearConsole() {
  document.getElementById('consoleOutput').innerHTML = '';
}

function addConsoleLine(level, args) {
  const output = document.getElementById('consoleOutput');
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const message = args.map(arg => {
    if (typeof arg === 'object') { try { return JSON.stringify(arg, null, 2); } catch { return String(arg); } }
    return String(arg);
  }).join(' ');

  const line = document.createElement('div');
  line.className = 'console-line';
  line.innerHTML = `<span class="console-timestamp">${timestamp}</span><span class="console-level ${level}">${level}</span><span class="console-message">${escapeHtml(message)}</span>`;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'console') addConsoleLine(e.data.level, e.data.args);
});

// WebRTC Voice Chat
async function toggleMic() {
  const btn = document.getElementById('micBtn');
  const icon = document.getElementById('micIcon');

  if (!micEnabled) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      });
      micEnabled = true;
      btn.classList.add('active');
      icon.innerHTML = '<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>';
      showToast('Microphone on');
      setupAudioVisualization();
      if (state.socket) state.socket.emit('mic-state', { roomId: state.currentRoom, enabled: true });
      state.roomUsers.forEach(user => createPeerConnection(user.id, true));
    } catch (err) {
      console.error('Mic error:', err);
      showToast('Microphone access denied');
    }
  } else {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    if (audioTrack.enabled) {
      btn.classList.remove('muted');
      btn.classList.add('active');
      showToast('Microphone unmuted');
    } else {
      btn.classList.add('muted');
      btn.classList.remove('active');
      showToast('Microphone muted');
    }
    if (state.socket) state.socket.emit('mic-state', { roomId: state.currentRoom, enabled: audioTrack.enabled });
  }
}

function setupAudioVisualization() {
  if (!localStream) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(localStream);
  source.connect(analyser);
  analyser.fftSize = 64;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  updateAudioVisualizer();
}

function updateAudioVisualizer() {
  if (!analyser || !micEnabled) return;
  analyser.getByteFrequencyData(dataArray);
  const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
  const indicator = document.getElementById('audioIndicator-self');
  if (indicator) {
    if (average > 20) indicator.classList.add('speaking');
    else indicator.classList.remove('speaking');
  }
  requestAnimationFrame(updateAudioVisualizer);
}

async function createPeerConnection(userId, isInitiator) {
  if (peerConnections[userId]) return;

  const config = await getTurnCredentials();
  const pc = new RTCPeerConnection(config);
  peerConnections[userId] = pc;

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.ontrack = (event) => {
    const remoteAudio = new Audio();
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.autoplay = true;
    remoteAudio.id = 'audio-' + userId;
    document.body.appendChild(remoteAudio);
    updateRemoteAudioIndicator(userId, true);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate && state.socket) {
      state.socket.emit('webrtc-ice', { roomId: state.currentRoom, targetId: userId, candidate: event.candidate });
    }
  };

  if (isInitiator) {
    pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
      if (state.socket) state.socket.emit('webrtc-offer', { roomId: state.currentRoom, targetId: userId, offer: pc.localDescription });
    });
  }
}

function handleWebRTCOffer(fromId, offer) {
  createPeerConnection(fromId, false).then(() => {
    const pc = peerConnections[fromId];
    pc.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => pc.createAnswer())
      .then(answer => pc.setLocalDescription(answer))
      .then(() => {
        if (state.socket) state.socket.emit('webrtc-answer', { roomId: state.currentRoom, targetId: fromId, answer: pc.localDescription });
      });
  });
}

function handleWebRTCAnswer(fromId, answer) {
  const pc = peerConnections[fromId];
  if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer));
}

function handleWebRTCIce(fromId, candidate) {
  const pc = peerConnections[fromId];
  if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
}

function updateRemoteAudioIndicator(userId, active) {
  const indicator = document.getElementById('audioIndicator-' + userId);
  if (indicator) {
    if (active) indicator.classList.add('speaking');
    else indicator.classList.remove('speaking');
  }
}

function renderAudioIndicators() {
  const container = document.getElementById('audioIndicators');
  if (!container) return;
  let html = '';
  if (micEnabled) {
    html += `<div class="audio-indicator" id="audioIndicator-self"><div class="audio-indicator-dot"></div><span>You</span></div>`;
  }
  state.roomUsers.forEach(user => {
    html += `<div class="audio-indicator" id="audioIndicator-${user.id}"><div class="audio-indicator-dot"></div><span>${escapeHtml(user.username)}</span></div>`;
  });
  container.innerHTML = html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.context-menu')) document.getElementById('contextMenu').style.display = 'none';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('contextMenu').style.display = 'none';
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  }
});

init();