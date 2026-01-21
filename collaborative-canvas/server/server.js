/**
 * Main Server File
 * Express + Socket.io server for real-time collaborative drawing canvas
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Import room and drawing state managers
const RoomManager = require('./rooms');
const DrawingStateManager = require('./drawing-state');

// Create Express app
const app = express();

// Enable CORS for all origins (adjust in production)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.io to the server
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Initialize managers
const roomManager = new RoomManager();
const drawingStateManager = new DrawingStateManager();

/**
 * Handle Socket.io connections
 */
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    /**
     * Handle user joining a room
     * Event: join-room
     * Payload: { roomId: string }
     */
    socket.on('join-room', (data) => {
        const { roomId } = data;
        
        if (!roomId) {
            socket.emit('error', { message: 'Room ID is required' });
            return;
        }

        // Join the socket room
        socket.join(roomId);

        // Add user to room manager
        const user = roomManager.addUser(socket.id, roomId);

        // Notify the user of their own user info
        socket.emit('user-info', {
            userId: user.userId,
            color: user.color
        });

        // Send list of existing users in the room to the newly joined user
        const existingUsers = roomManager.getRoomUsers(roomId)
            .filter(u => u.userId !== user.userId); // Exclude self
        socket.emit('existing-users', existingUsers.map(u => ({
            userId: u.userId,
            color: u.color
        })));

        // Notify other users in the room that a new user joined
        socket.to(roomId).emit('user-joined', {
            userId: user.userId,
            color: user.color,
            totalUsers: roomManager.getRoomUserCount(roomId)
        });

        // Send full drawing state to the newly joined user
        const fullState = drawingStateManager.getFullState(roomId);
        socket.emit('full-state-sync', fullState);

        console.log(`User ${user.userId} joined room ${roomId}`);
    });

    /**
     * Handle stroke start
     * Event: stroke-start
     * Payload: { roomId: string, x: number, y: number, color: string, size: number, type: string }
     */
    socket.on('stroke-start', (data) => {
        const { roomId, x, y, color, size, type } = data;
        
        if (!roomId) return;

        // Get user info from room
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        // Create new stroke
        const stroke = drawingStateManager.addStroke(roomId, {
            userId: user.userId,
            timestamp: Date.now(),
            type: type || 'draw',
            color: color,
            size: size,
            path: [{ x, y }]
        });

        // Forward to all users in the room (including sender) so they can sync IDs
        io.to(roomId).emit('stroke-start', {
            ...stroke,
            roomId
        });
    });

    /**
     * Handle stroke update (while drawing)
     * Event: stroke-update
     * Payload: { roomId: string, strokeId: string, x: number, y: number }
     */
    socket.on('stroke-update', (data) => {
        const { roomId, strokeId, x, y } = data;
        
        if (!roomId || !strokeId) return;

        // Update stroke in state manager
        const updated = drawingStateManager.updateStroke(roomId, strokeId, x, y);
        
        if (updated) {
            // Forward to all users in the room (including sender for consistency)
            io.to(roomId).emit('stroke-update', {
                roomId,
                strokeId,
                x,
                y
            });
        }
    });

    /**
     * Handle stroke end
     * Event: stroke-end
     * Payload: { roomId: string, strokeId: string }
     */
    socket.on('stroke-end', (data) => {
        const { roomId, strokeId } = data;
        
        if (!roomId || !strokeId) return;

        // Finalize stroke in state manager
        drawingStateManager.finalizeStroke(roomId, strokeId);

        // Forward to all users in the room (including sender for consistency)
        io.to(roomId).emit('stroke-end', {
            roomId,
            strokeId
        });
    });

    /**
     * Handle cursor movement
     * Event: cursor-move
     * Payload: { roomId: string, x: number, y: number }
     */
    socket.on('cursor-move', (data) => {
        const { roomId, x, y } = data;
        
        if (!roomId) return;

        // Get user info
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        // Forward cursor position to other users in the room
        socket.to(roomId).emit('cursor-move', {
            roomId,
            userId: user.userId,
            color: user.color,
            x,
            y
        });
    });

    /**
     * Handle undo action
     * Event: undo
     * Payload: { roomId: string }
     */
    socket.on('undo', (data) => {
        const { roomId } = data;
        
        if (!roomId) return;

        // Get user info
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        // Perform undo in state manager
        const undoneStroke = drawingStateManager.undo(roomId, user.userId);
        
        if (undoneStroke) {
            // Notify all users in the room (including sender)
            io.to(roomId).emit('undo', {
                roomId,
                userId: user.userId,
                strokeId: undoneStroke.id
            });
        }
    });

    /**
     * Handle redo action
     * Event: redo
     * Payload: { roomId: string }
     */
    socket.on('redo', (data) => {
        const { roomId } = data;
        
        if (!roomId) return;

        // Get user info
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        // Perform redo in state manager
        const redoneStroke = drawingStateManager.redo(roomId, user.userId);
        
        if (redoneStroke) {
            // Notify all users in the room (including sender)
            io.to(roomId).emit('redo', {
                roomId,
                userId: user.userId,
                stroke: redoneStroke
            });
        }
    });

    /**
     * Handle user disconnection
     */
    socket.on('disconnect', () => {
        // Get user info before removing
        const user = roomManager.getUser(socket.id);
        
        if (user) {
            const roomId = user.roomId;
            
            // Remove user from room
            roomManager.removeUser(socket.id);
            
            // Notify other users in the room
            socket.to(roomId).emit('user-left', {
                userId: user.userId,
                totalUsers: roomManager.getRoomUserCount(roomId)
            });
            
            console.log(`User ${user.userId} left room ${roomId}`);
        }
        
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
