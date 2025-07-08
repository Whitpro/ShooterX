// Bug reporting module for ShooterX
// Handles UI and submission of bug reports to GitHub

class BugReport {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.modalElement = null;
        this.createBugReportUI();
    }

    createBugReportUI() {
        // Create modal container
        this.modalElement = document.createElement('div');
        this.modalElement.id = 'bug-report-modal';
        this.modalElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            font-family: 'Rajdhani', 'Orbitron', sans-serif;
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: #181818;
            color: #f0f0f0;
            border-radius: 8px;
            padding: 20px;
            width: 80%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
            border: 1px solid rgba(0, 255, 255, 0.2);
            position: relative;
        `;

        // Create title
        const title = document.createElement('h2');
        title.textContent = 'Report a Bug';
        title.style.cssText = `
            color: #00ffff;
            margin-top: 0;
            text-align: center;
            font-size: 24px;
        `;

        // Create form
        const form = document.createElement('form');
        form.id = 'bug-report-form';
        form.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 15px;
        `;

        // Bug title
        const titleGroup = document.createElement('div');
        const titleLabel = document.createElement('label');
        titleLabel.textContent = 'Bug Title:';
        titleLabel.htmlFor = 'bug-title';
        titleLabel.style.cssText = `
            display: block;
            margin-bottom: 5px;
            color: #00ffff;
        `;
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.id = 'bug-title';
        titleInput.required = true;
        titleInput.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #2a2a2a;
            border: 1px solid #444;
            color: #fff;
            border-radius: 4px;
            font-family: inherit;
        `;
        titleGroup.appendChild(titleLabel);
        titleGroup.appendChild(titleInput);

        // Bug description
        const descGroup = document.createElement('div');
        const descLabel = document.createElement('label');
        descLabel.textContent = 'Description:';
        descLabel.htmlFor = 'bug-description';
        descLabel.style.cssText = `
            display: block;
            margin-bottom: 5px;
            color: #00ffff;
        `;
        const descInput = document.createElement('textarea');
        descInput.id = 'bug-description';
        descInput.required = true;
        descInput.rows = 5;
        descInput.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #2a2a2a;
            border: 1px solid #444;
            color: #fff;
            border-radius: 4px;
            resize: vertical;
            font-family: inherit;
        `;
        descGroup.appendChild(descLabel);
        descGroup.appendChild(descInput);

        // Steps to reproduce
        const stepsGroup = document.createElement('div');
        const stepsLabel = document.createElement('label');
        stepsLabel.textContent = 'Steps to Reproduce:';
        stepsLabel.htmlFor = 'bug-steps';
        stepsLabel.style.cssText = `
            display: block;
            margin-bottom: 5px;
            color: #00ffff;
        `;
        const stepsInput = document.createElement('textarea');
        stepsInput.id = 'bug-steps';
        stepsInput.rows = 3;
        stepsInput.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #2a2a2a;
            border: 1px solid #444;
            color: #fff;
            border-radius: 4px;
            resize: vertical;
            font-family: inherit;
        `;
        stepsGroup.appendChild(stepsLabel);
        stepsGroup.appendChild(stepsInput);

        // System info (auto-collected but visible)
        const sysInfoGroup = document.createElement('div');
        const sysInfoLabel = document.createElement('label');
        sysInfoLabel.textContent = 'System Information:';
        sysInfoLabel.htmlFor = 'bug-sysinfo';
        sysInfoLabel.style.cssText = `
            display: block;
            margin-bottom: 5px;
            color: #00ffff;
        `;
        const sysInfoInput = document.createElement('textarea');
        sysInfoInput.id = 'bug-sysinfo';
        sysInfoInput.rows = 2;
        sysInfoInput.readOnly = true;
        sysInfoInput.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #1a1a1a;
            border: 1px solid #444;
            color: #aaa;
            border-radius: 4px;
            resize: none;
            font-family: monospace;
            font-size: 12px;
        `;
        
        // Collect system info automatically
        const systemInfo = this.collectSystemInfo();
        sysInfoInput.value = systemInfo;
        
        sysInfoGroup.appendChild(sysInfoLabel);
        sysInfoGroup.appendChild(sysInfoInput);

        // Buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
        `;

        // Submit button
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'Submit Bug Report';
        submitButton.style.cssText = `
            background: linear-gradient(135deg, #2196F3, #1565C0);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 20px;
            cursor: pointer;
            font-family: inherit;
            font-size: 16px;
        `;

        // Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.style.cssText = `
            background: linear-gradient(135deg, #f44336, #c62828);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 20px;
            cursor: pointer;
            font-family: inherit;
            font-size: 16px;
        `;

        // Status message area
        const statusArea = document.createElement('div');
        statusArea.id = 'bug-report-status';
        statusArea.style.cssText = `
            margin-top: 10px;
            padding: 10px;
            border-radius: 4px;
            display: none;
        `;

        // Add all elements to the form
        buttonGroup.appendChild(cancelButton);
        buttonGroup.appendChild(submitButton);

        form.appendChild(titleGroup);
        form.appendChild(descGroup);
        form.appendChild(stepsGroup);
        form.appendChild(sysInfoGroup);
        form.appendChild(buttonGroup);

        // Add form to modal content
        modalContent.appendChild(title);
        modalContent.appendChild(form);
        modalContent.appendChild(statusArea);

        // Add modal content to modal container
        this.modalElement.appendChild(modalContent);

        // Add modal to document
        document.body.appendChild(this.modalElement);

        // Add event listeners
        form.addEventListener('submit', (e) => this.handleSubmit(e));
        cancelButton.addEventListener('click', () => this.hide());

        // Extra: Ensure pointer lock is released on any click in the modal
        this.modalElement.addEventListener('mousedown', () => {
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        });
    }

    collectSystemInfo() {
        const info = {
            userAgent: navigator.userAgent,
            gameVersion: 'ShooterX v1.2.0',
            platform: navigator.platform,
            timestamp: new Date().toISOString()
        };
        
        return `Game: ${info.gameVersion} | Platform: ${info.platform} | User-Agent: ${info.userAgent}`;
    }

    show() {
        if (!this.modalElement) {
            this.createBugReportUI();
        }
        
        // Reset form
        const form = document.getElementById('bug-report-form');
        if (form) form.reset();
        
        // Hide status message
        const status = document.getElementById('bug-report-status');
        if (status) status.style.display = 'none';
        
        // Make sure the game is fully paused/stopped
        this.pauseGame();
        
        // Always release pointer lock when showing the modal
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        // Show the modal
        this.modalElement.style.display = 'flex';
        this.isVisible = true;
        // Always show the mouse cursor when modal is open
        this.modalElement.style.cursor = 'default';
        document.body.style.cursor = 'default';
        // Set global flag so game/player code can respect modal state
        window.isBugReportOpen = true;
    }
    
    pauseGame() {
        if (!this.game) return;
        
        console.log('Bug reporter: Pausing game directly');
        
        // Store current game state to restore later
        this.wasGamePaused = this.game.isPaused || false;
        this._wasRunning = this.game.isRunning !== undefined ? this.game.isRunning : true;
        this._gameState = this.game.state; // Store original game state
        
        console.log('Bug reporter: Storing game state - wasPaused:', this.wasGamePaused, 
                   'wasRunning:', this._wasRunning, 'gameState:', this._gameState);
        
        // IMPORTANT: Do NOT call game.pauseGame() as it shows the pause menu
        // Instead, directly modify the game state flags to pause the game loop
        
        // Ensure the game loop is stopped by setting flags directly
        this.game.isPaused = true;
        if (typeof this.game.isRunning !== 'undefined') {
            this.game.isRunning = false;
        }
        
        // Hide the pause menu if it's currently showing
        if (this.game.ui && typeof this.game.ui.hidePauseMenu === 'function') {
            console.log('Bug reporter: Hiding pause menu if visible');
            this.game.ui.hidePauseMenu();
        }
        
        // Set our flag that we've paused the game
        this._pausedForBugReport = true;
    }

    hide() {
        if (this.modalElement) {
            this.modalElement.style.display = 'none';
        }
        this.isVisible = false;
        // Hide the mouse cursor again for the game (if pointer lock will be requested)
        // Only hide if the game is running and not paused
        if (
            this.game &&
            this._wasRunning &&
            !this.game.isPaused
        ) {
            document.body.style.cursor = 'none';
        }
        // Unset global flag
        window.isBugReportOpen = false;
        this.resumeGame();
    }
    
    resumeGame() {
        if (!this.game || !this._pausedForBugReport) return;
        
        console.log('Bug reporter: Resuming game directly - wasPaused:', this.wasGamePaused, 
                   'wasRunning:', this._wasRunning, 'gameState:', this._gameState);
        
        // If the game was already paused before the bug report, keep it paused
        if (this.wasGamePaused) {
            console.log('Bug reporter: Game was already paused, keeping paused state');
            // Just restore the running state if needed
            if (this._wasRunning !== undefined) {
                this.game.isRunning = this._wasRunning;
            }
            
            // Make sure the pause menu is showing if it should be
            if (this.game.ui && typeof this.game.ui.showPauseMenu === 'function') {
                console.log('Bug reporter: Re-showing pause menu for paused game');
                this.game.ui.showPauseMenu();
            }
        } else {
            // Otherwise fully resume the game
            console.log('Bug reporter: Fully resuming game by directly setting state flags');
            
            // First restore the isRunning flag
            if (this._wasRunning !== undefined) {
                this.game.isRunning = this._wasRunning;
            }
            
            // Then restore pause state
            this.game.isPaused = false;
            
            // If the game loop isn't running, try to restart it
            if (this.game.gameLoop && typeof this.game.gameLoop === 'function') {
                console.log('Bug reporter: Restarting game loop');
                requestAnimationFrame(this.game.gameLoop.bind(this.game));
            }
            
            // Immediately request pointer lock if the game is running and modal is closed
            if (
                this._wasRunning &&
                !this.game.isPaused &&
                document.pointerLockElement !== document.body &&
                typeof document.body.requestPointerLock === 'function'
            ) {
                document.body.requestPointerLock();
            }
        }
        
        // Reset our tracking variables
        this._pausedForBugReport = false;
        this._wasRunning = undefined;
        this.wasGamePaused = undefined;
        this._gameState = undefined;
        
        console.log('Bug reporter: Game state restored');
    }

    handleSubmit(event) {
        event.preventDefault();
        
        // Get form data
        const title = document.getElementById('bug-title').value;
        const description = document.getElementById('bug-description').value;
        const steps = document.getElementById('bug-steps').value;
        const systemInfo = document.getElementById('bug-sysinfo').value;
        
        // Validate required fields
        if (!title || !description) {
            const statusArea = document.getElementById('bug-report-status');
            statusArea.textContent = 'Please fill in at least the title and description fields.';
            statusArea.style.display = 'block';
            statusArea.style.background = '#c62828';
            statusArea.style.color = '#fff';
            return;
        }
        
        // Show submitting status
        const statusArea = document.getElementById('bug-report-status');
        statusArea.textContent = 'Submitting bug report...';
        statusArea.style.display = 'block';
        statusArea.style.background = '#333';
        statusArea.style.color = '#fff';
        
        // Prepare the data for submission
        const bugData = {
            title,
            description,
            steps,
            systemInfo
        };
        
        console.log('Submitting bug report to backend:', bugData);
        
        // API endpoint - change this to your deployed backend URL in production
        const API_URL = 'http://localhost:3000/api/report-bug';
        
        // Submit to backend server
        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bugData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Backend response:', data);
            
            if (data.success) {
                // Show success message with link if available
                let successMessage = 'Thank you for your report! The issue has been created on GitHub.';
                if (data.issueUrl) {
                    successMessage += `\nIssue #${data.issueNumber} created.`;
                }
                
                statusArea.textContent = successMessage;
                statusArea.style.background = '#1b5e20';
                statusArea.style.color = '#fff';
                
                // Close the modal after a delay and properly restore game state
                setTimeout(() => {
                    console.log('Bug reporter: Closing form after successful submission');
                    this.hide(); // This calls resumeGame() internally
                }, 3000);
            } else {
                throw new Error(data.message || 'Unknown error occurred');
            }
        })
        .catch(error => {
            console.error('Error submitting bug report:', error);
            
            // Show error message
            statusArea.textContent = `Error submitting bug report: ${error.message}. Please try again later.`;
            statusArea.style.background = '#c62828';
            statusArea.style.color = '#fff';
        });
    }
}

export default BugReport; 