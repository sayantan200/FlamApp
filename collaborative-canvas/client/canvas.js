/**
 * Canvas Drawing Module
 * Handles all drawing logic, stroke management, and undo/redo functionality
 * Now supports multiplayer with stroke metadata and event hooks
 */

class CanvasManager {
    constructor(canvasElement) {
        // Canvas and context references
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        
        // Drawing state
        this.isDrawing = false;
        this.currentPath = null;
        this.isEraserMode = false;
        
        // Drawing settings
        this.currentColor = '#000000';
        this.currentBrushSize = 5;
        
        // Stroke history for undo/redo
        // Each stroke is an object: { id, userId, timestamp, type: 'draw'|'erase', color: string, size: number, path: Array<{x, y}> }
        this.strokes = [];
        this.undoStack = []; // Stack for undone strokes
        
        // Map to track active remote strokes (strokeId -> stroke object)
        // Used for handling remote stroke updates before they're finalized
        this.activeRemoteStrokes = new Map();
        
        // Event hooks for multiplayer integration
        // These will be called when local user draws
        this.onStrokeStart = null;
        this.onStrokeUpdate = null;
        this.onStrokeEnd = null;
        
        // Initialize canvas
        this.resizeCanvas();
        this.setupEventListeners();
    }
    
    /**
     * Resize canvas to fill container while maintaining proper resolution
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Set canvas size to match container
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Redraw all strokes after resize
        this.redrawCanvas();
    }
    
    /**
     * Setup window resize listener to handle canvas resizing
     */
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    /**
     * Set the current drawing color
     * @param {string} color - Hex color string (e.g., '#000000')
     */
    setColor(color) {
        this.currentColor = color;
    }
    
    /**
     * Set the current brush size
     * @param {number} size - Brush size in pixels
     */
    setBrushSize(size) {
        this.currentBrushSize = size;
    }
    
    /**
     * Toggle eraser mode on/off
     * @param {boolean} enabled - True to enable eraser, false to disable
     */
    setEraserMode(enabled) {
        this.isEraserMode = enabled;
        if (enabled) {
            this.canvas.classList.add('eraser-mode');
        } else {
            this.canvas.classList.remove('eraser-mode');
        }
    }
    
    /**
     * Start a new drawing stroke
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} strokeId - Optional stroke ID (for remote strokes)
     * @param {string} userId - Optional user ID (for remote strokes)
     * @param {number} timestamp - Optional timestamp (for remote strokes)
     */
    startStroke(x, y, strokeId = null, userId = null, timestamp = null) {
        this.isDrawing = true;
        
        // Generate ID if not provided (local stroke)
        const id = strokeId || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const uid = userId || 'local';
        const ts = timestamp || Date.now();
        
        // Create new stroke object with metadata
        this.currentPath = {
            id: id,
            userId: uid,
            timestamp: ts,
            type: this.isEraserMode ? 'erase' : 'draw',
            color: this.isEraserMode ? null : this.currentColor, // Eraser doesn't have color
            size: this.currentBrushSize,
            path: [{ x, y }]
        };
        
        // Clear undo stack when starting a new stroke (can't redo after new action)
        // Only clear for local strokes
        if (userId === null) {
            this.undoStack = [];
        }
        
        // Emit stroke start event hook if this is a local stroke
        if (userId === null && this.onStrokeStart) {
            this.onStrokeStart(this.currentPath);
        }
    }
    
    /**
     * Continue drawing the current stroke
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    continueStroke(x, y) {
        if (!this.isDrawing || !this.currentPath) return;
        
        // Add point to current path
        this.currentPath.path.push({ x, y });
        
        // Draw the line segment immediately for smooth drawing
        this.drawPathSegment(this.currentPath);
        
        // Emit stroke update event hook if this is a local stroke
        if (this.currentPath.userId === 'local' && this.onStrokeUpdate) {
            this.onStrokeUpdate(this.currentPath, { x, y });
        }
    }
    
    /**
     * Draw a single line segment from the last point to the new point
     * This provides smooth, continuous drawing
     * @param {Object} stroke - Stroke object with path array
     */
    drawPathSegment(stroke) {
        if (stroke.path.length < 2) return;
        
        const path = stroke.path;
        const lastPoint = path[path.length - 2];
        const currentPoint = path[path.length - 1];
        
        // Set drawing context properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = stroke.size;
        
        if (stroke.type === 'erase') {
            // Eraser mode: use destination-out composite operation
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            // Draw mode: use normal composite operation
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = stroke.color;
        }
        
        // Draw line from last point to current point
        this.ctx.beginPath();
        this.ctx.moveTo(lastPoint.x, lastPoint.y);
        this.ctx.lineTo(currentPoint.x, currentPoint.y);
        this.ctx.stroke();
    }
    
    /**
     * End the current stroke and save it to history
     */
    endStroke() {
        if (!this.isDrawing || !this.currentPath) return;
        
        const wasLocalStroke = this.currentPath.userId === 'local';
        
        // Only save non-empty strokes (at least 2 points)
        if (this.currentPath.path.length >= 2) {
            this.strokes.push(this.currentPath);
        }
        
        // Emit stroke end event hook if this is a local stroke
        if (wasLocalStroke && this.onStrokeEnd) {
            this.onStrokeEnd(this.currentPath);
        }
        
        this.isDrawing = false;
        this.currentPath = null;
        
        // Reset composite operation
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    /**
     * Redraw the entire canvas from stroke history
     * Called after undo/redo or canvas resize
     */
    redrawCanvas() {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw all strokes in history
        this.strokes.forEach(stroke => {
            this.drawCompleteStroke(stroke);
        });
    }
    
    /**
     * Draw a complete stroke from its path array
     * @param {Object} stroke - Stroke object to draw
     */
    drawCompleteStroke(stroke) {
        if (stroke.path.length < 2) return;
        
        // Set drawing context properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = stroke.size;
        
        if (stroke.type === 'erase') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = stroke.color;
        }
        
        // Draw the entire path as a continuous line
        this.ctx.beginPath();
        this.ctx.moveTo(stroke.path[0].x, stroke.path[0].y);
        
        for (let i = 1; i < stroke.path.length; i++) {
            this.ctx.lineTo(stroke.path[i].x, stroke.path[i].y);
        }
        
        this.ctx.stroke();
        
        // Reset composite operation
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    /**
     * Undo the last stroke
     * Moves the last stroke from strokes array to undoStack
     * @returns {boolean} True if undo was successful, false if nothing to undo
     */
    undo() {
        if (this.strokes.length === 0) return false;
        
        // Pop the last stroke and add it to undo stack
        const lastStroke = this.strokes.pop();
        this.undoStack.push(lastStroke);
        
        // Redraw canvas without the undone stroke
        this.redrawCanvas();
        
        return true;
    }
    
    /**
     * Redo the last undone stroke
     * Moves the last stroke from undoStack back to strokes array
     * @returns {boolean} True if redo was successful, false if nothing to redo
     */
    redo() {
        if (this.undoStack.length === 0) return false;
        
        // Pop from undo stack and add back to strokes
        const lastUndoneStroke = this.undoStack.pop();
        this.strokes.push(lastUndoneStroke);
        
        // Redraw canvas with the redone stroke
        this.redrawCanvas();
        
        return true;
    }
    
    /**
     * Check if undo is available
     * @returns {boolean} True if there are strokes to undo
     */
    canUndo() {
        return this.strokes.length > 0;
    }
    
    /**
     * Check if redo is available
     * @returns {boolean} True if there are strokes to redo
     */
    canRedo() {
        return this.undoStack.length > 0;
    }
    
    /**
     * Clear the entire canvas
     */
    clear() {
        this.strokes = [];
        this.undoStack = [];
        this.activeRemoteStrokes.clear();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // ========== Remote Stroke Handlers ==========
    // These methods handle strokes from other users in multiplayer mode
    
    /**
     * Apply a remote stroke start event
     * Creates a new stroke that will be updated as points come in
     * @param {Object} stroke - Stroke object with id, userId, timestamp, type, color, size, and initial point
     */
    applyRemoteStrokeStart(stroke) {
        // Don't handle our own strokes (they're already handled locally)
        if (stroke.userId === 'local') return;
        
        // Create stroke object from remote data
        const remoteStroke = {
            id: stroke.id,
            userId: stroke.userId,
            timestamp: stroke.timestamp,
            type: stroke.type || 'draw',
            color: stroke.color,
            size: stroke.size,
            path: stroke.path ? [...stroke.path] : []
        };
        
        // Store in active remote strokes map
        this.activeRemoteStrokes.set(stroke.id, remoteStroke);
        
        // Draw initial point if path has at least one point
        if (remoteStroke.path.length > 0) {
            const point = remoteStroke.path[0];
            this.drawPoint(remoteStroke, point);
        }
    }
    
    /**
     * Apply a remote stroke update event
     * Adds a new point to an existing remote stroke and draws it
     * @param {string} strokeId - ID of the stroke to update
     * @param {Object} point - New point { x, y }
     */
    applyRemoteStrokeUpdate(strokeId, point) {
        // Get the active remote stroke
        const stroke = this.activeRemoteStrokes.get(strokeId);
        if (!stroke) return;
        
        // Add point to stroke path
        stroke.path.push({ x: point.x, y: point.y });
        
        // Draw the line segment for smooth remote drawing
        this.drawPathSegment(stroke);
    }
    
    /**
     * Apply a remote stroke end event
     * Finalizes the stroke and moves it to the main strokes array
     * @param {string} strokeId - ID of the stroke to finalize
     */
    applyRemoteStrokeEnd(strokeId) {
        // Get the active remote stroke
        const stroke = this.activeRemoteStrokes.get(strokeId);
        if (!stroke) return;
        
        // Only save non-empty strokes (at least 2 points)
        if (stroke.path.length >= 2) {
            // Add to main strokes array
            this.strokes.push(stroke);
        }
        
        // Remove from active remote strokes
        this.activeRemoteStrokes.delete(strokeId);
    }
    
    /**
     * Draw a single point (used for initial remote stroke point)
     * @param {Object} stroke - Stroke object
     * @param {Object} point - Point { x, y }
     */
    drawPoint(stroke, point) {
        // Set drawing context properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = stroke.size;
        
        if (stroke.type === 'erase') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = stroke.color;
        }
        
        // Draw a small circle for the point
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Reset composite operation
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    /**
     * Apply a complete stroke from remote (used for full state sync)
     * Adds the stroke directly to the strokes array without going through start/update/end
     * @param {Object} stroke - Complete stroke object
     */
    applyRemoteCompleteStroke(stroke) {
        // Don't handle our own strokes
        if (stroke.userId === 'local') return;
        
        // Create a copy of the stroke
        const strokeCopy = {
            id: stroke.id,
            userId: stroke.userId,
            timestamp: stroke.timestamp,
            type: stroke.type || 'draw',
            color: stroke.color,
            size: stroke.size,
            path: stroke.path ? [...stroke.path] : []
        };
        
        // Only add non-empty strokes
        if (strokeCopy.path.length >= 2) {
            this.strokes.push(strokeCopy);
            // Redraw to show the new stroke
            this.drawCompleteStroke(strokeCopy);
        }
    }
}
