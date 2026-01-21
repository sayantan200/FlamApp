/**
 * Drawing State Management Module
 * Maintains stroke history per room and handles undo/redo operations
 */

/**
 * Drawing State Manager Class
 * Manages drawing state (strokes) for each room
 */
class DrawingStateManager {
    constructor() {
        // Map of roomId -> { strokes: Array, undoStack: Map<userId, Array> }
        this.roomStates = new Map();
        
        // Counter for unique stroke IDs
        this.strokeIdCounter = 0;
    }

    /**
     * Get or create room state
     * @param {string} roomId - Room ID
     * @returns {Object} Room state object
     */
    _getRoomState(roomId) {
        if (!this.roomStates.has(roomId)) {
            this.roomStates.set(roomId, {
                strokes: [], // Array of completed strokes
                undoStacks: new Map() // Map of userId -> Array of undone strokes
            });
        }
        return this.roomStates.get(roomId);
    }

    /**
     * Generate a unique stroke ID
     * @returns {string} Unique stroke ID
     */
    _generateStrokeId() {
        return `stroke_${++this.strokeIdCounter}_${Date.now()}`;
    }

    /**
     * Add a new stroke to a room
     * @param {string} roomId - Room ID
     * @param {Object} strokeData - Stroke data (userId, timestamp, type, color, size, path)
     * @returns {Object} Complete stroke object with ID
     */
    addStroke(roomId, strokeData) {
        const roomState = this._getRoomState(roomId);
        
        // Create complete stroke object
        const stroke = {
            id: this._generateStrokeId(),
            userId: strokeData.userId,
            timestamp: strokeData.timestamp || Date.now(),
            type: strokeData.type || 'draw',
            color: strokeData.color,
            size: strokeData.size,
            path: [...strokeData.path] // Copy path array
        };
        
        // Add to strokes array
        roomState.strokes.push(stroke);
        
        // Clear undo stack for this user when new stroke is added
        roomState.undoStacks.delete(strokeData.userId);
        
        return stroke;
    }

    /**
     * Update an existing stroke with a new point
     * @param {string} roomId - Room ID
     * @param {string} strokeId - Stroke ID to update
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if stroke was found and updated
     */
    updateStroke(roomId, strokeId, x, y) {
        const roomState = this.roomStates.get(roomId);
        if (!roomState) return false;
        
        // Find the stroke
        const stroke = roomState.strokes.find(s => s.id === strokeId);
        if (!stroke) return false;
        
        // Add new point to path
        stroke.path.push({ x, y });
        
        return true;
    }

    /**
     * Finalize a stroke (mark it as complete)
     * @param {string} roomId - Room ID
     * @param {string} strokeId - Stroke ID to finalize
     */
    finalizeStroke(roomId, strokeId) {
        // Stroke is already in the strokes array, no additional action needed
        // This method exists for potential future use (e.g., validation)
    }

    /**
     * Undo the last stroke by a specific user
     * @param {string} roomId - Room ID
     * @param {string} userId - User ID who performed the undo
     * @returns {Object|null} Undone stroke object or null if nothing to undo
     */
    undo(roomId, userId) {
        const roomState = this.roomStates.get(roomId);
        if (!roomState) return null;
        
        // Find the last stroke by this user
        let lastUserStrokeIndex = -1;
        for (let i = roomState.strokes.length - 1; i >= 0; i--) {
            if (roomState.strokes[i].userId === userId) {
                lastUserStrokeIndex = i;
                break;
            }
        }
        
        // If no stroke found, return null
        if (lastUserStrokeIndex === -1) return null;
        
        // Remove stroke from strokes array
        const undoneStroke = roomState.strokes.splice(lastUserStrokeIndex, 1)[0];
        
        // Add to user's undo stack
        if (!roomState.undoStacks.has(userId)) {
            roomState.undoStacks.set(userId, []);
        }
        roomState.undoStacks.get(userId).push(undoneStroke);
        
        return undoneStroke;
    }

    /**
     * Redo the last undone stroke by a specific user
     * @param {string} roomId - Room ID
     * @param {string} userId - User ID who performed the redo
     * @returns {Object|null} Redone stroke object or null if nothing to redo
     */
    redo(roomId, userId) {
        const roomState = this.roomStates.get(roomId);
        if (!roomState) return null;
        
        // Get user's undo stack
        const undoStack = roomState.undoStacks.get(userId);
        if (!undoStack || undoStack.length === 0) return null;
        
        // Pop the last undone stroke
        const redoneStroke = undoStack.pop();
        
        // Add it back to strokes array
        roomState.strokes.push(redoneStroke);
        
        // Clean up empty undo stack
        if (undoStack.length === 0) {
            roomState.undoStacks.delete(userId);
        }
        
        return redoneStroke;
    }

    /**
     * Get the full drawing state for a room
     * @param {string} roomId - Room ID
     * @returns {Object} Full state object with strokes array
     */
    getFullState(roomId) {
        const roomState = this.roomStates.get(roomId);
        
        if (!roomState) {
            return {
                roomId,
                strokes: []
            };
        }
        
        return {
            roomId,
            strokes: roomState.strokes.map(stroke => ({
                id: stroke.id,
                userId: stroke.userId,
                timestamp: stroke.timestamp,
                type: stroke.type,
                color: stroke.color,
                size: stroke.size,
                path: [...stroke.path] // Return a copy of the path
            }))
        };
    }

    /**
     * Clear all strokes for a room (optional utility method)
     * @param {string} roomId - Room ID
     */
    clearRoom(roomId) {
        this.roomStates.delete(roomId);
    }
}

module.exports = DrawingStateManager;
