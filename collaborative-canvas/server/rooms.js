/**
 * Room Management Module
 * Handles room creation, user tracking, and user color assignment
 */

// Predefined color palette for users
const USER_COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
    '#F8B739', // Orange
    '#52BE80'  // Green
];

/**
 * Room Manager Class
 * Manages rooms and users within rooms
 */
class RoomManager {
    constructor() {
        // Map of socketId -> user object
        this.users = new Map();
        
        // Map of roomId -> Set of socketIds
        this.rooms = new Map();
        
        // Track color usage per room to assign unique colors
        // Map of roomId -> Set of used colors
        this.roomColors = new Map();
        
        // Counter for unique user IDs
        this.userIdCounter = 0;
    }

    /**
     * Add a user to a room
     * @param {string} socketId - Socket ID of the user
     * @param {string} roomId - Room ID to join
     * @returns {Object} User object with userId, color, and roomId
     */
    addUser(socketId, roomId) {
        // Generate unique user ID
        const userId = `user_${++this.userIdCounter}_${Date.now()}`;
        
        // Get or create room
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
            this.roomColors.set(roomId, new Set());
        }
        
        // Get available colors for this room
        const usedColors = this.roomColors.get(roomId);
        
        // Find an available color
        let assignedColor = USER_COLORS.find(color => !usedColors.has(color));
        
        // If all colors are used, assign a random one
        if (!assignedColor) {
            assignedColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
        }
        
        // Mark color as used
        usedColors.add(assignedColor);
        
        // Create user object
        const user = {
            userId,
            socketId,
            roomId,
            color: assignedColor
        };
        
        // Store user
        this.users.set(socketId, user);
        
        // Add socket to room
        this.rooms.get(roomId).add(socketId);
        
        return user;
    }

    /**
     * Remove a user from their room
     * @param {string} socketId - Socket ID of the user to remove
     */
    removeUser(socketId) {
        const user = this.users.get(socketId);
        
        if (!user) return;
        
        const { roomId, color } = user;
        
        // Remove socket from room
        const roomSockets = this.rooms.get(roomId);
        if (roomSockets) {
            roomSockets.delete(socketId);
            
            // If room is empty, clean it up
            if (roomSockets.size === 0) {
                this.rooms.delete(roomId);
                this.roomColors.delete(roomId);
            } else {
                // Free up the color for reuse
                const usedColors = this.roomColors.get(roomId);
                usedColors.delete(color);
            }
        }
        
        // Remove user from users map
        this.users.delete(socketId);
    }

    /**
     * Get user information by socket ID
     * @param {string} socketId - Socket ID
     * @returns {Object|null} User object or null if not found
     */
    getUser(socketId) {
        return this.users.get(socketId) || null;
    }

    /**
     * Get the number of users in a room
     * @param {string} roomId - Room ID
     * @returns {number} Number of users in the room
     */
    getRoomUserCount(roomId) {
        const roomSockets = this.rooms.get(roomId);
        return roomSockets ? roomSockets.size : 0;
    }

    /**
     * Get all users in a room
     * @param {string} roomId - Room ID
     * @returns {Array} Array of user objects
     */
    getRoomUsers(roomId) {
        const roomSockets = this.rooms.get(roomId);
        if (!roomSockets) return [];
        
        return Array.from(roomSockets)
            .map(socketId => this.users.get(socketId))
            .filter(user => user !== undefined);
    }
}

module.exports = RoomManager;
