/**
 * Main Application Module
 * Handles UI wiring, event listeners, and user interactions
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
        if (canvasManager.isDrawing) {
            const coords = getCoordinates(e);
            canvasManager.continueStroke(coords.x, coords.y);
        }
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
        if (canvasManager.isDrawing) {
            const coords = getCoordinates(e);
            canvasManager.continueStroke(coords.x, coords.y);
        }
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
     */
    undoBtn.addEventListener('click', () => {
        canvasManager.undo();
        updateButtonStates();
    });
    
    /**
     * Redo button click handler
     */
    redoBtn.addEventListener('click', () => {
        canvasManager.redo();
        updateButtonStates();
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
     * Note: Using Ctrl+Z and Ctrl+Y (Windows/Linux) or Cmd+Z and Cmd+Shift+Z (Mac)
     */
    document.addEventListener('keydown', (e) => {
        // Undo: Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (canvasManager.canUndo()) {
                canvasManager.undo();
                updateButtonStates();
            }
        }
        // Redo: Ctrl+Y or Ctrl+Shift+Z (Windows/Linux) or Cmd+Shift+Z (Mac)
        else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            if (canvasManager.canRedo()) {
                canvasManager.redo();
                updateButtonStates();
            }
        }
    });
    
    // Initialize button states
    updateButtonStates();
});
