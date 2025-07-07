const Input = {
    keys: {},
    mouseButtons: {},
    mousePosition: { x: 0, y: 0 },
    mouseDelta: { x: 0, y: 0 },
    
    init() {
        this.keys = {};
        this.mouseButtons = {};
        this.mousePosition = { x: 0, y: 0 };
        this.mouseDelta = { x: 0, y: 0 };
        
        // Add global mouse handler to track mouse movement
        document.addEventListener('mousemove', (event) => {
            // Only record deltas when pointer is locked
            if (document.pointerLockElement === document.body) {
                this.mouseDelta.x += event.movementX || 0;
                this.mouseDelta.y += event.movementY || 0;
            }
            
            // Always update position
            this.mousePosition.x = event.clientX;
            this.mousePosition.y = event.clientY;
        });
        
        // Add global mouse button handlers
        document.addEventListener('mousedown', (event) => {
            this.mouseButtons[event.button] = true;
        });
        
        document.addEventListener('mouseup', (event) => {
            this.mouseButtons[event.button] = false;
        });
    },
    
    handleKeyDown(event) {
        this.keys[event.key.toLowerCase()] = true;
    },
    
    handleKeyUp(event) {
        this.keys[event.key.toLowerCase()] = false;
    },
    
    // Add these methods for compatibility with game.js calls
    handleMouseDown(event) {
        this.mouseButtons[event.button] = true;
    },
    
    handleMouseUp(event) {
        this.mouseButtons[event.button] = false;
    },
    
    isKeyPressed(key) {
        return this.keys[key.toLowerCase()] === true;
    },
    
    isMouseButtonPressed(button) {
        let buttonIndex = 0;
        if (button === 'left') buttonIndex = 0;
        else if (button === 'middle') buttonIndex = 1;
        else if (button === 'right') buttonIndex = 2;
        
        return this.mouseButtons[buttonIndex] === true;
    },
    
    getMousePosition() {
        return { ...this.mousePosition };
    },
    
    getMouseDelta() {
        const delta = { ...this.mouseDelta };
        // Reset delta after reading
        this.mouseDelta = { x: 0, y: 0 };
        return delta;
    },
    
    update() {
        // Reset one-frame values if needed
    },
    
    reset() {
        // Reset all input state
        this.keys = {};
        this.mouseButtons = {};
        this.mousePosition = { x: 0, y: 0 };
        this.mouseDelta = { x: 0, y: 0 };
    }
};

export default Input; 