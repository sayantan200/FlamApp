# Collaborative Canvas

A real-time collaborative drawing application that allows multiple users to draw together on a shared canvas. Built with Node.js, Express, Socket.io, and vanilla JavaScript.

## 🌐 Live Demo

**Try it now**: [https://flam-app-iota.vercel.app/](https://flam-app-iota.vercel.app/)

## Features

- **Real-time Collaboration**: Multiple users can draw simultaneously on the same canvas
- **Live Cursor Tracking**: See where other users are drawing in real-time
- **User Management**: Track active users with color-coded indicators
- **Drawing Tools**:
  - Customizable brush size (1-50px)
  - Color picker for custom colors
  - Eraser tool
  - Undo/Redo functionality (keyboard shortcuts supported)
- **Touch Support**: Works on mobile and tablet devices
- **Room-based Sessions**: Multiple drawing rooms for different sessions

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express** - Web server framework
- **Socket.io** - Real-time bidirectional communication
- **CORS** - Cross-origin resource sharing

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5 Canvas** - Drawing surface
- **Socket.io Client** - Real-time communication
- **CSS3** - Modern styling

## Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html      # Main HTML file
│   ├── style.css       # Stylesheet
│   ├── main.js         # Application logic and Socket.io integration
│   └── canvas.js       # Canvas drawing manager
├── server/
│   ├── server.js       # Express server and Socket.io setup
│   ├── rooms.js        # Room and user management
│   └── drawing-state.js # Drawing state management per room
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sayantan200/FlamApp.git
cd collaborative-canvas
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

For production:
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in the `PORT` environment variable).

### Client Setup

The client files are static HTML/CSS/JS files. You can:

1. **Local Development**: Open `client/index.html` in a browser (note: Socket.io connection will need to point to your local server)

2. **Production**: Deploy the `client/` folder to a static hosting service (e.g., Vercel)

## Deployment

### Backend (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the following:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. Add environment variables if needed (e.g., `PORT`)
5. Deploy

The backend URL will be something like: `https://your-app.onrender.com`

### Frontend (Vercel)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Navigate to the client directory:
```bash
cd client
```

3. Deploy:
```bash
vercel
```

Or connect your GitHub repository to Vercel and set the root directory to `client/`.

**Important**: Update the Socket.io connection URL in `client/main.js` to point to your Render backend URL:

```javascript
const socket = io("https://your-backend-url.onrender.com");
```

## Usage

1. Open the application in your browser
2. Start drawing with your mouse or touch device
3. Other users in the same room will see your drawings in real-time
4. Use the toolbar to:
   - Change brush color
   - Adjust brush size
   - Toggle eraser mode
   - Undo/Redo actions
5. Keyboard shortcuts:
   - `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (Mac) - Undo
   - `Ctrl+Y` or `Ctrl+Shift+Z` (Windows/Linux) or `Cmd+Shift+Z` (Mac) - Redo

## API Endpoints

### Health Check
- `GET /health` - Returns server status

## Socket.io Events

### Client → Server

- `join-room` - Join a drawing room
- `stroke-start` - Start a new stroke
- `stroke-update` - Update stroke while drawing
- `stroke-end` - End a stroke
- `cursor-move` - Update cursor position
- `undo` - Undo last stroke
- `redo` - Redo last undone stroke

### Server → Client

- `user-info` - User's own ID and color
- `existing-users` - List of users already in room
- `user-joined` - New user joined notification
- `user-left` - User left notification
- `full-state-sync` - Complete drawing state when joining
- `stroke-start` - Remote stroke started
- `stroke-update` - Remote stroke updated
- `stroke-end` - Remote stroke ended
- `cursor-move` - Remote cursor moved
- `undo` - Stroke undone globally
- `redo` - Stroke redone globally

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server on file changes.

### Project Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## License

ISC

## Repository

[GitHub Repository](https://github.com/sayantan200/FlamApp)
