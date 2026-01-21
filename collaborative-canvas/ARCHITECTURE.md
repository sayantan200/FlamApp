# Architecture Documentation

## Overview

Collaborative Canvas is a real-time collaborative drawing application built with a client-server architecture. The system enables multiple users to draw simultaneously on a shared canvas with real-time synchronization.

## System Architecture

```
┌─────────────────┐         WebSocket           ┌─────────────────┐
│                 │ ◄────────────────────────►  │                 │
│   Client (Web)  │         (Socket.io)         │  Server (Node)  │
│                 │                             │                 │
│  - Canvas UI    │                             │  - Room Manager │
│  - Drawing      │                             │  - State Manager│
│  - Socket.io    │                             │  - Socket.io    │
│    Client       │                             │    Server       │
└─────────────────┘                             └─────────────────┘
```

## Component Architecture

### Client Side

#### 1. `main.js` - Application Controller
**Responsibility**: Orchestrates UI interactions, Socket.io communication, and coordinates between canvas and server.

**Key Functions**:
- Socket.io connection management
- User interface event handling (toolbar, keyboard shortcuts)
- User list management and display
- Remote cursor tracking and rendering
- Stroke synchronization with server
- Mouse and touch event handling

**Data Structures**:
- `users` - Map of userId → user data (name, color, isDrawing)
- `remoteCursors` - Map of userId → cursor position
- `activeStrokesByUser` - Map of userId → Set of active stroke IDs
- `strokeOwners` - Map of strokeId → userId
- `strokeIdMap` - Map of localId → serverId

#### 2. `canvas.js` - Canvas Manager
**Responsibility**: Handles all drawing operations, stroke management, and canvas rendering.

**Key Classes**:
- `CanvasManager` - Main canvas controller

**Key Methods**:
- `startStroke()` - Begin a new drawing stroke
- `continueStroke()` - Add points to current stroke
- `endStroke()` - Finalize and save stroke
- `undo()` / `redo()` - History management
- `applyRemoteStrokeStart()` - Handle remote stroke start
- `applyRemoteStrokeUpdate()` - Handle remote stroke updates
- `applyRemoteStrokeEnd()` - Handle remote stroke completion
- `redrawCanvas()` - Redraw entire canvas from stroke history

**Data Structures**:
- `strokes` - Array of completed strokes
- `undoStack` - Array of undone strokes
- `activeRemoteStrokes` - Map of strokeId → stroke object (for in-progress remote strokes)

**Stroke Object Structure**:
```javascript
{
  id: string,           // Unique stroke ID
  userId: string,       // User who created the stroke
  timestamp: number,    // Creation timestamp
  type: 'draw'|'erase', // Stroke type
  color: string,        // Stroke color (null for eraser)
  size: number,         // Brush size
  path: Array<{x, y}>   // Array of points
}
```

### Server Side

#### 1. `server.js` - Main Server
**Responsibility**: Express server setup, Socket.io server initialization, and event routing.

**Key Components**:
- Express HTTP server
- Socket.io server with CORS configuration
- Event handlers for all Socket.io events
- Health check endpoint

**Socket.io Event Handlers**:
- `connection` - New client connection
- `join-room` - User joins a room
- `stroke-start` - New stroke begins
- `stroke-update` - Stroke point added
- `stroke-end` - Stroke completed
- `cursor-move` - Cursor position update
- `undo` - Undo operation
- `redo` - Redo operation
- `disconnect` - User disconnects

#### 2. `rooms.js` - Room Manager
**Responsibility**: Manages rooms, user assignments, and color allocation.

**Key Class**:
- `RoomManager`

**Key Methods**:
- `addUser()` - Add user to room, assign color
- `removeUser()` - Remove user from room, free color
- `getUser()` - Get user by socket ID
- `getRoomUserCount()` - Get number of users in room
- `getRoomUsers()` - Get all users in a room

**Data Structures**:
- `users` - Map of socketId → user object
- `rooms` - Map of roomId → Set of socketIds
- `roomColors` - Map of roomId → Set of used colors
- `userIdCounter` - Counter for unique user IDs

**User Object Structure**:
```javascript
{
  userId: string,    // Unique user ID (format: "user_{counter}_{timestamp}")
  socketId: string,  // Socket.io socket ID
  roomId: string,    // Room the user is in
  color: string      // Assigned color for this user
}
```

**Color Assignment**:
- Uses predefined palette of 10 colors
- Tries to assign unique colors per room
- Falls back to random color if all are used

#### 3. `drawing-state.js` - Drawing State Manager
**Responsibility**: Maintains drawing state (strokes) per room and handles undo/redo operations.

**Key Class**:
- `DrawingStateManager`

**Key Methods**:
- `addStroke()` - Add new stroke to room state
- `updateStroke()` - Add point to existing stroke
- `finalizeStroke()` - Mark stroke as complete
- `undo()` - Undo last stroke by user
- `redo()` - Redo last undone stroke by user
- `getFullState()` - Get complete drawing state for room

**Data Structures**:
- `roomStates` - Map of roomId → room state object
- `strokeIdCounter` - Counter for unique stroke IDs

**Room State Structure**:
```javascript
{
  strokes: Array,              // Array of completed strokes
  undoStacks: Map<userId, Array>  // Per-user undo stacks
}
```

## Data Flow

### Drawing Flow

1. **User starts drawing**:
   ```
   Client: Mouse/Touch down
   → CanvasManager.startStroke()
   → Emit 'stroke-start' to server
   → Server: Create stroke, assign ID
   → Server: Broadcast 'stroke-start' to all clients (including sender)
   → Client: Update local stroke ID with server ID
   ```

2. **User continues drawing**:
   ```
   Client: Mouse/Touch move
   → CanvasManager.continueStroke()
   → Draw line segment immediately
   → Emit 'stroke-update' to server
   → Server: Update stroke path
   → Server: Broadcast 'stroke-update' to all clients
   → Remote clients: Apply update to active remote stroke
   ```

3. **User ends drawing**:
   ```
   Client: Mouse/Touch up
   → CanvasManager.endStroke()
   → Save stroke to history
   → Emit 'stroke-end' to server
   → Server: Finalize stroke
   → Server: Broadcast 'stroke-end' to all clients
   → Remote clients: Move stroke from active to completed
   ```

### Room Join Flow

1. **Client connects**:
   ```
   Client: Socket.io connection established
   → Server: Create socket connection
   ```

2. **Client joins room**:
   ```
   Client: Emit 'join-room' with roomId
   → Server: Add user to room
   → Server: Assign user ID and color
   → Server: Emit 'user-info' to client
   → Server: Emit 'existing-users' to client
   → Server: Emit 'full-state-sync' with all strokes
   → Server: Broadcast 'user-joined' to other users
   → Client: Render all strokes, update user list
   ```

### Undo/Redo Flow

1. **User performs undo**:
   ```
   Client: Click undo or Ctrl+Z
   → Emit 'undo' to server
   → Server: Find last stroke by this user
   → Server: Remove stroke, add to user's undo stack
   → Server: Broadcast 'undo' to all clients
   → All clients: Remove stroke from canvas
   ```

2. **User performs redo**:
   ```
   Client: Click redo or Ctrl+Y
   → Emit 'redo' to server
   → Server: Pop from user's undo stack
   → Server: Add stroke back to room state
   → Server: Broadcast 'redo' to all clients
   → All clients: Add stroke back to canvas
   ```

## Real-time Synchronization

### Stroke ID Management

The system uses a two-phase ID assignment:
1. **Local ID**: Client generates temporary ID when stroke starts
2. **Server ID**: Server generates permanent ID and sends back
3. **ID Mapping**: Client maintains mapping between local and server IDs

This ensures:
- Immediate local feedback (optimistic updates)
- Consistent IDs across all clients
- Proper stroke tracking during updates

### State Consistency

- **Full State Sync**: New users receive complete drawing state on join
- **Incremental Updates**: Existing users receive only new strokes
- **Optimistic Updates**: Local drawing appears immediately
- **Server Authority**: Server is source of truth for stroke IDs and state

## Scalability Considerations

### Current Architecture
- In-memory state storage (per-room state in memory)
- Single server instance
- Suitable for small to medium scale

### Potential Improvements
- **Persistence**: Add database for stroke storage
- **Horizontal Scaling**: Use Redis for shared state
- **Load Balancing**: Multiple server instances with sticky sessions
- **Rate Limiting**: Prevent abuse and ensure fair usage
- **Stroke Compression**: Reduce network payload for large drawings

## Security Considerations

### Current Implementation
- CORS enabled for all origins (development)
- No authentication/authorization
- No input validation beyond basic checks

### Recommended Enhancements
- **Authentication**: User authentication system
- **Authorization**: Room access control
- **Input Validation**: Validate stroke coordinates, sizes, etc.
- **Rate Limiting**: Prevent spam and abuse
- **CORS Configuration**: Restrict to specific origins in production

## Deployment Architecture

### Backend (Render)
- Node.js runtime
- Express HTTP server
- Socket.io WebSocket server
- Environment: Production Node.js

### Frontend (Vercel)
- Static file hosting
- CDN distribution
- Automatic HTTPS
- Environment: Static site

### Communication
- WebSocket connection from Vercel frontend to Render backend
- CORS configured to allow cross-origin requests

## Performance Optimizations

1. **Canvas Rendering**:
   - Immediate local rendering for smooth UX
   - Batch remote updates when possible
   - Efficient redraw algorithm

2. **Network**:
   - Only send stroke updates, not full state
   - Compress stroke data if needed
   - Throttle cursor updates

3. **Memory**:
   - Clean up disconnected users
   - Remove empty rooms
   - Limit stroke history per room (future)

## Error Handling

### Client Side
- Socket.io reconnection handling
- Graceful degradation if server unavailable
- Error logging to console

### Server Side
- Basic error handling in event handlers
- User removal on disconnect
- Room cleanup on empty

### Future Improvements
- Comprehensive error logging
- Error recovery mechanisms
- User-facing error messages
- Retry logic for failed operations
