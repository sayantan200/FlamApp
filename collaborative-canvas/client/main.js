/**
 * Main Application Module
 * Handles UI wiring, event listeners, and user interactions
 * Now includes Socket.io integration for multiplayer support
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const canvas = document.getElementById('drawingCanvas');
    const colorPicker = document.getElementById('colorPicker');
    const brushSize = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    const eraserBtn = document.getElementById('eraserBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    // Initialize canvas manager
    const canvasManager = new CanvasManager(canvas);
    
    // ========== Socket.io Connection ==========
    // Connect to the server 
    const socket = io("https://collaborative-canvas-backend-l85t.onrender.com");
    
    // Current user info (set by server)
    let currentUserId = null;
    let currentUserColor = '#000000';
    let currentRoomId = 'default';
    
    // Map to store remote user cursors (userId -> { x, y, color })
    const remoteCursors = new Map();
    
    // ========== Active Users Tracking ==========
    // Map to store all users: userId -> { name, color, isDrawing }
    const users = new Map();
    
    // Map to track active strokes per user: userId -> Set of strokeIds
    const activeStrokesByUser = new Map();
    
    // Map to track which user owns which stroke: strokeId -> userId
    const strokeOwners = new Map();
    
    // Get sidebar DOM elements
    const usersList = document.getElementById('usersList');
    
    /**
     * Extract user number from userId to create consistent names
     * userId format: "user_{counter}_{timestamp}"
     * @param {string} userId - User ID from server
     * @returns {string} Consistent user name like "User 1", "User 2", etc.
     */
    function getUserNameFromId(userId) {
        // Extract the counter number from userId format: "user_{counter}_{timestamp}"
        const match = userId.match(/^user_(\d+)_/);
        if (match && match[1]) {
            const userNumber = parseInt(match[1], 10);
            return `User ${userNumber}`;
        }
        // Fallback: use a hash of the userId for consistency
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = ((hash << 5) - hash) + userId.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `User ${Math.abs(hash) % 1000 + 1}`;
    }
    
    /**
     * Update the users list UI
     * Renders all users with their status (drawing/idle)
     */
    function updateUsersList() {
        // Clear existing list
        usersList.innerHTML = '';
        
        // Sort users: drawing users first, then by name
        const sortedUsers = Array.from(users.entries()).sort((a, b) => {
            // Drawing users first
            if (a[1].isDrawing && !b[1].isDrawing) return -1;
            if (!a[1].isDrawing && b[1].isDrawing) return 1;
            // Then sort by name
            return a[1].name.localeCompare(b[1].name);
        });
        
        // Create list items for each user
        sortedUsers.forEach(([userId, userData]) => {
            const li = document.createElement('li');
            li.className = `user-item ${userData.isDrawing ? 'drawing' : 'idle'}`;
            
            // Colored dot
            const dot = document.createElement('div');
            dot.className = 'user-dot';
            dot.style.backgroundColor = userData.color;
            
            // User info container
            const info = document.createElement('div');
            info.className = 'user-info';
            
            // User name
            const name = document.createElement('div');
            name.className = 'user-name';
            name.textContent = userData.name;
            
            // User status
            const status = document.createElement('div');
            status.className = 'user-status';
            status.textContent = userData.isDrawing ? 'Drawing' : 'Idle';
            
            // Assemble
            info.appendChild(name);
            info.appendChild(status);
            li.appendChild(dot);
            li.appendChild(info);
            usersList.appendChild(li);
        });
    }
    
    /**
     * Mark a user as drawing
     * @param {string} userId - User ID
     */
    function markUserDrawing(userId) {
        if (users.has(userId)) {
            users.get(userId).isDrawing = true;
            updateUsersList();
        }
    }
    
    /**
     * Mark a user as idle (if they have no active strokes)
     * @param {string} userId - User ID
     */
    function markUserIdleIfNoActiveStrokes(userId) {
        if (users.has(userId)) {
            const activeStrokes = activeStrokesByUser.get(userId);
            if (!activeStrokes || activeStrokes.size === 0) {
                users.get(userId).isDrawing = false;
                updateUsersList();
            }
        }
    }
    
    // Map to track pending local strokes (localId -> serverId)
    // This helps us map local stroke IDs to server-generated IDs
    const strokeIdMap = new Map();
    
    // Create a separate canvas layer for cursors (overlay)
    const cursorCanvas = document.createElement('canvas');
    cursorCanvas.id = 'cursorCanvas';
    cursorCanvas.style.position = 'absolute';
    cursorCanvas.style.top = '0';
    cursorCanvas.style.left = '0';
    cursorCanvas.style.pointerEvents = 'none';
    cursorCanvas.style.zIndex = '10';
    canvas.parentElement.appendChild(cursorCanvas);
    const cursorCtx = cursorCanvas.getContext('2d');
    
    // Resize cursor canvas to match main canvas
    function resizeCursorCanvas() {
        const rect = canvas.getBoundingClientRect();
        cursorCanvas.width = canvas.width;
        cursorCanvas.height = canvas.height;
        cursorCanvas.style.width = rect.width + 'px';
        cursorCanvas.style.height = rect.height + 'px';
    }
    resizeCursorCanvas();
    window.addEventListener('resize', resizeCursorCanvas);
    
    // Function to render all remote cursors
    function renderCursors() {
        cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
        
        // Coordinates are already in canvas space, so use them directly
        remoteCursors.forEach((cursor, userId) => {
            if (userId === currentUserId) return; // Don't draw own cursor
            
            cursorCtx.fillStyle = cursor.color;
            cursorCtx.beginPath();
            cursorCtx.arc(
                cursor.x,
                cursor.y,
                5, // Cursor dot radius
                0,
                Math.PI * 2
            );
            cursorCtx.fill();
        });
    }
    
    // Join default room on connection
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('join-room', { roomId: currentRoomId });
    });
    
    // Handle user info (our own user ID and color)
    socket.on('user-info', (data) => {
        currentUserId = data.userId;
        currentUserColor = data.color;
        console.log('User info received:', data);
        
        // Add ourselves to users map with consistent name based on userId
        users.set(data.userId, {
            name: getUserNameFromId(data.userId),
            color: data.color,
            isDrawing: false
        });
        updateUsersList();
    });
    
    // Handle existing users list (sent when joining a room)
    socket.on('existing-users', (usersList) => {
        console.log('Existing users received:', usersList.length);
        
        // Add all existing users to our users map with consistent names
        usersList.forEach(userData => {
            if (!users.has(userData.userId)) {
                users.set(userData.userId, {
                    name: getUserNameFromId(userData.userId),
                    color: userData.color,
                    isDrawing: false
                });
            }
        });
        updateUsersList();
    });
    
    // Handle user joined event
    socket.on('user-joined', (data) => {
        console.log('User joined:', data);
        
        // Add new user to users map with consistent name based on userId
        if (!users.has(data.userId)) {
            users.set(data.userId, {
                name: getUserNameFromId(data.userId),
                color: data.color,
                isDrawing: false
            });
            updateUsersList();
        }
    });
    
    // Handle user left event
    socket.on('user-left', (data) => {
        console.log('User left:', data);
        
        // Remove user from map
        users.delete(data.userId);
        
        // Clean up user's active strokes tracking
        activeStrokesByUser.delete(data.userId);
        
        // Clean up stroke owner mappings for this user's strokes
        const strokesToRemove = [];
        strokeOwners.forEach((ownerId, strokeId) => {
            if (ownerId === data.userId) {
                strokesToRemove.push(strokeId);
            }
        });
        strokesToRemove.forEach(strokeId => strokeOwners.delete(strokeId));
        
        updateUsersList();
        
        // Remove their cursor
        remoteCursors.delete(data.userId);
        renderCursors();
    });
    
    // Handle full state sync (when joining a room)
    socket.on('full-state-sync', (data) => {
        console.log('Full state sync received:', data.strokes.length, 'strokes');
        // Clear current canvas
        canvasManager.clear();
        // Apply all strokes from the server
        data.strokes.forEach(stroke => {
            canvasManager.applyRemoteCompleteStroke(stroke);
        });
    });
    
    // Handle remote stroke start
    socket.on('stroke-start', (data) => {
        // Check if this is our own stroke by comparing userId
        if (data.userId === currentUserId) {
            // This is our own stroke coming back from the server
            // Update the local stroke ID to match the server's ID
            if (canvasManager.currentPath && canvasManager.currentPath.userId === 'local') {
                const localId = canvasManager.currentPath.id;
                canvasManager.currentPath.id = data.id;
                strokeIdMap.set(localId, data.id);
                
                // Update active strokes tracking: replace local ID with server ID
                // Ensure the set exists (it should from onStrokeStart, but be safe)
                if (!activeStrokesByUser.has(currentUserId)) {
                    activeStrokesByUser.set(currentUserId, new Set());
                }
                const activeStrokes = activeStrokesByUser.get(currentUserId);
                activeStrokes.delete(localId);
                activeStrokes.add(data.id);
                
                // Update stroke owner mapping
                strokeOwners.delete(localId);
                strokeOwners.set(data.id, currentUserId);
            }
            // We're already marked as drawing from onStrokeStart, so no need to mark again
        } else {
            // This is a remote stroke
            // Track this stroke as active for this user
            if (!activeStrokesByUser.has(data.userId)) {
                activeStrokesByUser.set(data.userId, new Set());
            }
            activeStrokesByUser.get(data.userId).add(data.id);
            strokeOwners.set(data.id, data.userId);
            
            // Mark user as drawing
            markUserDrawing(data.userId);
            
            // Apply the remote stroke
            canvasManager.applyRemoteStrokeStart(data);
        }
    });
    
    // Handle remote stroke update
    socket.on('stroke-update', (data) => {
        canvasManager.applyRemoteStrokeUpdate(data.strokeId, { x: data.x, y: data.y });
    });
    
    // Handle remote stroke end
    socket.on('stroke-end', (data) => {
        canvasManager.applyRemoteStrokeEnd(data.strokeId);
        
        // Get the user who owns this stroke
        let userId = strokeOwners.get(data.strokeId);
        
        // Fallback: if not found in strokeOwners, search all users' active strokes
        if (!userId) {
            for (const [uid, activeStrokes] of activeStrokesByUser.entries()) {
                if (activeStrokes.has(data.strokeId)) {
                    userId = uid;
                    break;
                }
            }
        }
        
        if (userId) {
            // Remove this stroke from user's active strokes
            const activeStrokes = activeStrokesByUser.get(userId);
            if (activeStrokes) {
                activeStrokes.delete(data.strokeId);
                // Clean up empty sets
                if (activeStrokes.size === 0) {
                    activeStrokesByUser.delete(userId);
                }
            }
            
            // Mark user as idle if they have no more active strokes
            markUserIdleIfNoActiveStrokes(userId);
            
            // Clean up stroke owner mapping (try both server ID and any mapped local ID)
            strokeOwners.delete(data.strokeId);
            // Also clean up any local ID that might map to this server ID
            for (const [localId, serverId] of strokeIdMap.entries()) {
                if (serverId === data.strokeId) {
                    strokeOwners.delete(localId);
                    break;
                }
            }
        }
    });
    
    // Handle global undo event
    socket.on('undo', (data) => {
        // Find and remove the stroke by ID
        const strokeIndex = canvasManager.strokes.findIndex(s => s.id === data.strokeId);
        if (strokeIndex !== -1) {
            canvasManager.strokes.splice(strokeIndex, 1);
            canvasManager.redrawCanvas();
            updateButtonStates();
        }
    });
    
    // Handle global redo event
    socket.on('redo', (data) => {
        // Add the redone stroke
        if (data.stroke) {
            canvasManager.applyRemoteCompleteStroke(data.stroke);
        }
        updateButtonStates();
    });
    
    // Handle remote cursor movement
    socket.on('cursor-move', (data) => {
        if (data.userId === currentUserId) return; // Ignore own cursor
        
        remoteCursors.set(data.userId, {
            x: data.x,
            y: data.y,
            color: data.color
        });
        renderCursors();
    });
    
    // Set up event hooks in canvas manager to emit to server
    canvasManager.onStrokeStart = (stroke) => {
        // Mark ourselves as drawing immediately for better UX
        if (currentUserId) {
            markUserDrawing(currentUserId);
            // Track local stroke ID temporarily - will be updated when server responds
            if (!activeStrokesByUser.has(currentUserId)) {
                activeStrokesByUser.set(currentUserId, new Set());
            }
            activeStrokesByUser.get(currentUserId).add(stroke.id);
            strokeOwners.set(stroke.id, currentUserId);
        }
        
        socket.emit('stroke-start', {
            roomId: currentRoomId,
            x: stroke.path[0].x,
            y: stroke.path[0].y,
            color: stroke.color,
            size: stroke.size,
            type: stroke.type
        });
        // Note: The server will generate an ID and send it back via stroke-start event
        // We'll update our local stroke ID when we receive it
    };
    
    canvasManager.onStrokeUpdate = (stroke, point) => {
        // Use the mapped server ID if available, otherwise use the current ID
        // (which should be updated to server ID by the time updates are sent)
        const strokeId = strokeIdMap.get(stroke.id) || stroke.id;
        socket.emit('stroke-update', {
            roomId: currentRoomId,
            strokeId: strokeId,
            x: point.x,
            y: point.y
        });
    };
    
    canvasManager.onStrokeEnd = (stroke) => {
        // Use the mapped server ID if available, otherwise use the current ID
        const strokeId = strokeIdMap.get(stroke.id) || stroke.id;
        
        // Remove local stroke tracking
        if (currentUserId) {
            const activeStrokes = activeStrokesByUser.get(currentUserId);
            if (activeStrokes) {
                // Remove both local and server IDs if they exist
                activeStrokes.delete(stroke.id);
                activeStrokes.delete(strokeId);
                if (activeStrokes.size === 0) {
                    activeStrokesByUser.delete(currentUserId);
                }
            }
            strokeOwners.delete(stroke.id);
            strokeOwners.delete(strokeId);
            
            // Mark as idle if no more active strokes
            markUserIdleIfNoActiveStrokes(currentUserId);
        }
        
        socket.emit('stroke-end', {
            roomId: currentRoomId,
            strokeId: strokeId
        });
        // Clean up the ID mapping after stroke ends
        strokeIdMap.delete(stroke.id);
    };
    
    /**
     * Get mouse/touch coordinates relative to canvas
     * @param {Event} e - Mouse or touch event
     * @returns {Object} Object with x and y coordinates
     */
    function getCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // Handle both mouse and touch events
        const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
        const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    /**
     * Update undo/redo button states based on availability
     */
    function updateButtonStates() {
        undoBtn.disabled = !canvasManager.canUndo();
        redoBtn.disabled = !canvasManager.canRedo();
    }
    
    // ========== Mouse Event Handlers ==========
    
    /**
     * Handle mouse down - start drawing
     */
    function handleMouseDown(e) {
        e.preventDefault();
        const coords = getCoordinates(e);
        canvasManager.startStroke(coords.x, coords.y);
        updateButtonStates();
    }
    
    /**
     * Handle mouse move - continue drawing
     */
    function handleMouseMove(e) {
        e.preventDefault();
        const coords = getCoordinates(e);
        
        if (canvasManager.isDrawing) {
            canvasManager.continueStroke(coords.x, coords.y);
        }
        
        // Emit cursor position for multiplayer
        socket.emit('cursor-move', {
            roomId: currentRoomId,
            x: coords.x,
            y: coords.y
        });
    }
    
    /**
     * Handle mouse up - end drawing
     */
    function handleMouseUp(e) {
        e.preventDefault();
        canvasManager.endStroke();
        updateButtonStates();
    }
    
    /**
     * Handle mouse leave - end drawing if mouse leaves canvas
     */
    function handleMouseLeave(e) {
        e.preventDefault();
        if (canvasManager.isDrawing) {
            canvasManager.endStroke();
            updateButtonStates();
        }
    }
    
    // ========== Touch Event Handlers ==========
    
    /**
     * Handle touch start - start drawing
     */
    function handleTouchStart(e) {
        e.preventDefault();
        const coords = getCoordinates(e);
        canvasManager.startStroke(coords.x, coords.y);
        updateButtonStates();
    }
    
    /**
     * Handle touch move - continue drawing
     */
    function handleTouchMove(e) {
        e.preventDefault();
        const coords = getCoordinates(e);
        
        if (canvasManager.isDrawing) {
            canvasManager.continueStroke(coords.x, coords.y);
        }
        
        // Emit cursor position for multiplayer (touch devices)
        socket.emit('cursor-move', {
            roomId: currentRoomId,
            x: coords.x,
            y: coords.y
        });
    }
    
    /**
     * Handle touch end - end drawing
     */
    function handleTouchEnd(e) {
        e.preventDefault();
        canvasManager.endStroke();
        updateButtonStates();
    }
    
    // ========== Toolbar Event Handlers ==========
    
    /**
     * Color picker change handler
     */
    colorPicker.addEventListener('input', (e) => {
        canvasManager.setColor(e.target.value);
        // Disable eraser mode when color is selected
        if (canvasManager.isEraserMode) {
            canvasManager.setEraserMode(false);
            eraserBtn.classList.remove('active');
        }
    });
    
    /**
     * Brush size slider change handler
     */
    brushSize.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        canvasManager.setBrushSize(size);
        brushSizeValue.textContent = size;
    });
    
    /**
     * Eraser button click handler
     */
    eraserBtn.addEventListener('click', () => {
        const isCurrentlyEraser = canvasManager.isEraserMode;
        canvasManager.setEraserMode(!isCurrentlyEraser);
        
        if (!isCurrentlyEraser) {
            eraserBtn.classList.add('active');
        } else {
            eraserBtn.classList.remove('active');
        }
    });
    
    /**
     * Undo button click handler
     * Now emits to server for global undo
     */
    undoBtn.addEventListener('click', () => {
        // Emit undo to server - server will handle the logic and broadcast
        socket.emit('undo', { roomId: currentRoomId });
        // Note: We don't call canvasManager.undo() here because the server
        // will broadcast the undo event back to all clients (including us)
    });
    
    /**
     * Redo button click handler
     * Now emits to server for global redo
     */
    redoBtn.addEventListener('click', () => {
        // Emit redo to server - server will handle the logic and broadcast
        socket.emit('redo', { roomId: currentRoomId });
        // Note: We don't call canvasManager.redo() here because the server
        // will broadcast the redo event back to all clients (including us)
    });
    
    // ========== Mouse Event Listeners ==========
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    // ========== Touch Event Listeners ==========
    
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);
    
    // ========== Keyboard Shortcuts ==========
    
    /**
     * Handle keyboard shortcuts for undo/redo
     * Now emits to server for global undo/redo
     * Note: Using Ctrl+Z and Ctrl+Y (Windows/Linux) or Cmd+Z and Cmd+Shift+Z (Mac)
     */
    document.addEventListener('keydown', (e) => {
        // Undo: Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            // Emit to server for global undo
            socket.emit('undo', { roomId: currentRoomId });
        }
        // Redo: Ctrl+Y or Ctrl+Shift+Z (Windows/Linux) or Cmd+Shift+Z (Mac)
        else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            // Emit to server for global redo
            socket.emit('redo', { roomId: currentRoomId });
        }
    });
    
    // Initialize button states
    updateButtonStates();
});
