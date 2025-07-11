// Bug reporting module for ShooterX
// Handles UI and submission of bug reports locally

class BugReport {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.modalElement = null;
        this.viewMode = false; // Flag to toggle between report form and view reports
        this.reports = this.loadReports(); // Load saved reports
        this.createBugReportUI();
    }

    // Load saved reports from localStorage
    loadReports() {
        try {
            const saved = localStorage.getItem('shooterx_bug_reports');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading bug reports:', error);
            return [];
        }
    }

    // Save reports to localStorage
    saveReports() {
        try {
            localStorage.setItem('shooterx_bug_reports', JSON.stringify(this.reports));
        } catch (error) {
            console.error('Error saving bug reports:', error);
        }
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
        modalContent.id = 'bug-report-content';
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

        // Create form container (will be toggled with view container)
        const formContainer = document.createElement('div');
        formContainer.id = 'bug-report-form-container';

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

        // Buttons for form
        const formButtonGroup = document.createElement('div');
        formButtonGroup.style.cssText = `
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

        // View Reports button
        const viewReportsButton = document.createElement('button');
        viewReportsButton.type = 'button';
        viewReportsButton.textContent = 'View Reports';
        viewReportsButton.style.cssText = `
            background: linear-gradient(135deg, #4CAF50, #2E7D32);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 20px;
            cursor: pointer;
            font-family: inherit;
            font-size: 16px;
            margin-right: auto;
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

        // Add buttons to form button group
        formButtonGroup.appendChild(viewReportsButton);
        formButtonGroup.appendChild(cancelButton);
        formButtonGroup.appendChild(submitButton);

        // Add all elements to the form
        form.appendChild(titleGroup);
        form.appendChild(descGroup);
        form.appendChild(stepsGroup);
        form.appendChild(sysInfoGroup);
        form.appendChild(formButtonGroup);

        // Add form to form container
        formContainer.appendChild(title);
        formContainer.appendChild(form);
        formContainer.appendChild(statusArea);

        // Create view reports container (initially hidden)
        const viewContainer = document.createElement('div');
        viewContainer.id = 'bug-report-view-container';
        viewContainer.style.display = 'none';

        // Create view reports title
        const viewTitle = document.createElement('h2');
        viewTitle.textContent = 'Saved Bug Reports';
        viewTitle.style.cssText = `
            color: #00ffff;
            margin-top: 0;
            text-align: center;
            font-size: 24px;
        `;

        // Create reports list container
        const reportsList = document.createElement('div');
        reportsList.id = 'bug-reports-list';
        reportsList.style.cssText = `
            margin: 15px 0;
            max-height: 60vh;
            overflow-y: auto;
        `;

        // Create view container buttons
        const viewButtonGroup = document.createElement('div');
        viewButtonGroup.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
        `;

        // Back to form button
        const backButton = document.createElement('button');
        backButton.type = 'button';
        backButton.textContent = 'Back to Form';
        backButton.style.cssText = `
            background: linear-gradient(135deg, #2196F3, #1565C0);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 20px;
            cursor: pointer;
            font-family: inherit;
            font-size: 16px;
        `;

        // Delete All button
        const deleteAllButton = document.createElement('button');
        deleteAllButton.type = 'button';
        deleteAllButton.textContent = 'Delete All Reports';
        deleteAllButton.style.cssText = `
            background: linear-gradient(135deg, #f44336, #c62828);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 20px;
            cursor: pointer;
            font-family: inherit;
            font-size: 16px;
        `;

        // Export button
        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.textContent = 'Export Reports';
        exportButton.style.cssText = `
            background: linear-gradient(135deg, #FF9800, #F57C00);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 20px;
            cursor: pointer;
            font-family: inherit;
            font-size: 16px;
        `;

        // Add buttons to view button group
        viewButtonGroup.appendChild(backButton);
        viewButtonGroup.appendChild(exportButton);
        viewButtonGroup.appendChild(deleteAllButton);

        // Add elements to view container
        viewContainer.appendChild(viewTitle);
        viewContainer.appendChild(reportsList);
        viewContainer.appendChild(viewButtonGroup);

        // Add both containers to modal content
        modalContent.appendChild(formContainer);
        modalContent.appendChild(viewContainer);

        // Add modal content to modal container
        this.modalElement.appendChild(modalContent);

        // Add modal to document
        document.body.appendChild(this.modalElement);

        // Add event listeners
        form.addEventListener('submit', (e) => this.handleSubmit(e));
        cancelButton.addEventListener('click', () => this.hide());
        viewReportsButton.addEventListener('click', () => this.showReports());
        backButton.addEventListener('click', () => this.showForm());
        deleteAllButton.addEventListener('click', () => this.deleteAllReports());
        exportButton.addEventListener('click', () => this.exportReports());

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
            gameVersion: 'ShooterX v1.2.7',
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
        
        // Show form by default
        this.showForm();
        
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
    
    showForm() {
        // Switch to form view
        document.getElementById('bug-report-form-container').style.display = 'block';
        document.getElementById('bug-report-view-container').style.display = 'none';
        this.viewMode = false;
    }
    
    showReports() {
        // Switch to reports view
        document.getElementById('bug-report-form-container').style.display = 'none';
        document.getElementById('bug-report-view-container').style.display = 'block';
        this.viewMode = true;
        
        // Refresh reports list
        this.renderReportsList();
    }
    
    renderReportsList() {
        const reportsList = document.getElementById('bug-reports-list');
        reportsList.innerHTML = '';
        
        if (this.reports.length === 0) {
            const noReports = document.createElement('div');
            noReports.textContent = 'No bug reports saved.';
            noReports.style.cssText = `
                text-align: center;
                color: #aaa;
                padding: 20px;
            `;
            reportsList.appendChild(noReports);
            return;
        }
        
        // Create a card for each report
        this.reports.forEach((report, index) => {
            const card = document.createElement('div');
            card.className = 'bug-report-card';
            card.style.cssText = `
                background: #222;
                border-radius: 4px;
                padding: 15px;
                margin-bottom: 15px;
                border-left: 4px solid #00ffff;
            `;
            
            const cardHeader = document.createElement('div');
            cardHeader.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            `;
            
            const cardTitle = document.createElement('h3');
            cardTitle.textContent = report.title;
            cardTitle.style.cssText = `
                margin: 0;
                color: #00ffff;
                font-size: 18px;
            `;
            
            const cardDate = document.createElement('span');
            cardDate.textContent = new Date(report.timestamp).toLocaleString();
            cardDate.style.cssText = `
                color: #aaa;
                font-size: 12px;
            `;
            
            const cardDesc = document.createElement('p');
            cardDesc.textContent = report.description;
            cardDesc.style.cssText = `
                margin: 10px 0;
                color: #ddd;
            `;
            
            const cardActions = document.createElement('div');
            cardActions.style.cssText = `
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 10px;
            `;
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.style.cssText = `
                background: #c62828;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 5px 10px;
                cursor: pointer;
                font-size: 14px;
            `;
            deleteButton.addEventListener('click', () => this.deleteReport(index));
            
            // Assemble card
            cardHeader.appendChild(cardTitle);
            cardHeader.appendChild(cardDate);
            cardActions.appendChild(deleteButton);
            
            card.appendChild(cardHeader);
            card.appendChild(cardDesc);
            
            // Only show steps if provided
            if (report.steps) {
                const cardSteps = document.createElement('div');
                cardSteps.style.cssText = `
                    margin: 10px 0;
                    padding: 10px;
                    background: #1a1a1a;
                    border-radius: 4px;
                `;
                
                const stepsTitle = document.createElement('strong');
                stepsTitle.textContent = 'Steps to Reproduce:';
                stepsTitle.style.color = '#00ffff';
                
                const stepsContent = document.createElement('p');
                stepsContent.textContent = report.steps;
                stepsContent.style.cssText = `
                    margin: 5px 0 0;
                    color: #bbb;
                    font-size: 14px;
                `;
                
                cardSteps.appendChild(stepsTitle);
                cardSteps.appendChild(stepsContent);
                card.appendChild(cardSteps);
            }
            
            card.appendChild(cardActions);
            reportsList.appendChild(card);
        });
    }
    
    deleteReport(index) {
        if (index >= 0 && index < this.reports.length) {
            this.reports.splice(index, 1);
            this.saveReports();
            this.renderReportsList();
        }
    }
    
    deleteAllReports() {
        if (confirm('Are you sure you want to delete all bug reports? This cannot be undone.')) {
            this.reports = [];
            this.saveReports();
            this.renderReportsList();
        }
    }
    
    exportReports() {
        if (this.reports.length === 0) {
            alert('No bug reports to export.');
            return;
        }
        
        // Format reports as JSON
        const jsonData = JSON.stringify(this.reports, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `shooterx_bug_reports_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
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
        statusArea.textContent = 'Saving bug report...';
        statusArea.style.display = 'block';
        statusArea.style.background = '#333';
        statusArea.style.color = '#fff';
        
        // Create report object
        const report = {
            title,
            description,
            steps: steps || '',
            systemInfo,
            timestamp: new Date().toISOString()
        };
        
        // Add to reports array
        this.reports.push(report);
        
        // Save to localStorage
        this.saveReports();
        
        console.log('Bug report saved locally:', report);
        
        // Show success message
        statusArea.textContent = 'Bug report saved locally. Thank you!';
        statusArea.style.background = '#1b5e20';
        statusArea.style.color = '#fff';
        
        // Close the modal after a delay and properly restore game state
        setTimeout(() => {
            console.log('Bug reporter: Closing form after successful submission');
            this.hide(); // This calls resumeGame() internally
        }, 2000);
    }
}

export default BugReport; 