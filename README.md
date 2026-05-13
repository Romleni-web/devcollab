# DevCollab

Real-time collaborative coding platform with project rooms, Monaco Editor, live preview, and team chat.

## Features

- **Project Rooms**: Create and join coding projects with descriptions
- **Monaco Editor**: VS Code-powered editor with syntax highlighting for 20+ languages
- **Real-time Collaboration**: Live code sync via WebSocket with cursor tracking
- **Live Preview**: Instant HTML/CSS/JS preview side-by-side
- **Team Chat**: Real-time messaging with your team
- **Feature Voting**: Submit and vote on feature requests
- **File Management**: Create, rename, delete, duplicate, download files
- **Dark Theme**: VS Code-inspired dark interface

## Quick Start

```bash
cd server
npm install
npm start
```

Open `http://localhost:3000` in your browser.

## File Structure

```
devcollab/
├── server/
│   ├── server.js          # Express + Socket.IO backend
│   └── package.json       # Dependencies
└── client/
    ├── index.html         # Main HTML
    ├── css/
    │   └── style.css      # VS Code dark theme styles
    └── js/
        └── app.js         # Frontend logic + Monaco integration
```

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JS, Monaco Editor (VS Code)
- **Real-time**: WebSocket for code sync, cursors, chat
- **Storage**: In-memory (add MongoDB/PostgreSQL for production)

## Keyboard Shortcuts

- `Ctrl+S` / `Cmd+S`: Save file
- `Escape`: Close modals/menus
- `Tab`: Indent in editor

## Production Notes

- Replace in-memory storage with MongoDB/PostgreSQL
- Add user authentication (JWT)
- Add Git integration
- Add file upload/download for entire projects
- Add voice/video calls via WebRTC
