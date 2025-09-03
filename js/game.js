class VimGame {
    constructor() {
        this.editor = null;
        this.exerciseLoader = new ExerciseLoader();
        this.currentExercise = null;
        this.allowedKeys = [];
        this.keyPressHistory = [];
        this.exerciseStartTime = null;
        
        // Motion tracking
        this.currentMotionBuffer = [];
        this.commandHistory = [];
        this.maxHistoryItems = 5;
        this.motionCheckInterval = null;
    }

    async init() {
        // Initialize CodeMirror
        this.initEditor();
        
        // Load exercises
        await this.exerciseLoader.loadChapters();
        
        // Load first exercise
        this.loadExercise();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.updateUI();
    }

    initEditor() {
        const textarea = document.getElementById('vim-editor');
        this.editor = CodeMirror.fromTextArea(textarea, {
            mode: 'text',
            theme: 'monokai',
            keyMap: 'vim',
            lineNumbers: true,
            showCursorWhenSelecting: true,
            lineWrapping: true,
            autofocus: true,
            // Disable mouse-based selections
            configureMouse: function() {
                return {extend: false, addNew: false};
            },
            // Block non-Vim selection shortcuts
            extraKeys: {
                "Shift-Left": false,
                "Shift-Right": false,
                "Shift-Up": false,
                "Shift-Down": false,
                "Shift-Home": false,
                "Shift-End": false,
                "Ctrl-A": false,
                "Cmd-A": false,
                "Ctrl-Shift-Left": false,
                "Ctrl-Shift-Right": false,
                "Cmd-Shift-Left": false,
                "Cmd-Shift-Right": false,
                "Shift-LeftClick": function() { return false; },
                "Ctrl-LeftClick": function() { return false; },
                "Cmd-LeftClick": function() { return false; },
                "Alt-LeftClick": function() { return false; },
                // Manual check solution shortcuts
                "Ctrl-Enter": (cm) => { this.checkExerciseCompletion(true); return false; },
                "Cmd-Enter": (cm) => { this.checkExerciseCompletion(true); return false; }
            }
        });

        // Track vim mode changes
        this.editor.on('vim-mode-change', (e) => {
            this.onVimModeChange(e);
        });

        // Track key events
        this.editor.on('vim-keypress', (key) => {
            this.onKeyPress(key);
        });

        // Track content changes (but ignore programmatic changes)
        this.editor.on('change', (cm, changeObj) => {
            // Only check completion for user-initiated changes
            if (changeObj.origin !== 'setValue') {
                this.checkExerciseCompletion();
            }
        });

        // Add mouse event handlers to prevent drag selection
        const wrapper = this.editor.getWrapperElement();
        wrapper.addEventListener('mousedown', (e) => {
            if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, true);

        // Prevent drag selection
        wrapper.addEventListener('selectstart', (e) => {
            e.preventDefault();
            return false;
        });

        // Don't override vim commands - let them work naturally
        // We'll track changes via the change event instead
        
        // Start motion buffer tracking
        this.startMotionTracking();
    }
    
    startMotionTracking() {
        // Poll for vim motion buffer changes
        this.motionCheckInterval = setInterval(() => {
            try {
                // Access vim state through CodeMirror's vim adapter
                const vim = this.editor.state.vim;
                if (!vim) {
                    console.log('No vim state found');
                    return;
                }
                
                const inputState = vim.inputState;
                if (!inputState) {
                    console.log('No inputState found');
                    return;
                }
                
                // Get the current key buffer
                const keyBuffer = inputState.keyBuffer || [];
                const currentBuffer = keyBuffer.join('');
                
                // Update motion display
                this.updateMotionDisplay(currentBuffer);
                
                // Check if buffer was cleared (command executed)
                if (this.currentMotionBuffer.length > 0 && keyBuffer.length === 0) {
                    // Command was executed, add to history
                    const executedCommand = this.currentMotionBuffer.join('');
                    if (executedCommand) {
                        this.addToCommandHistory(executedCommand);
                        
                        // Check completion after command execution
                        setTimeout(() => {
                            this.checkExerciseCompletion();
                        }, 100); // Small delay to let DOM update
                    }
                }
                
                // Update our tracking
                this.currentMotionBuffer = [...keyBuffer];
                
                // Debug logging
                if (currentBuffer) {
                    console.log('Current vim motion:', currentBuffer);
                }
            } catch (e) {
                console.error('Error tracking vim motion:', e);
            }
        }, 50); // Check every 50ms for responsive updates
    }
    
    updateMotionDisplay(motion) {
        const motionBufferEl = document.getElementById('motion-buffer');
        if (motionBufferEl) {
            motionBufferEl.textContent = motion;
            
            // Add visual feedback when typing
            if (motion) {
                motionBufferEl.classList.add('active');
            } else {
                motionBufferEl.classList.remove('active');
            }
        }
    }
    
    addToCommandHistory(command) {
        // Add to history array
        this.commandHistory.unshift({
            command: command,
            timestamp: Date.now(),
            exercise: this.currentExercise ? this.currentExercise.title : null
        });
        
        // Keep only recent items
        if (this.commandHistory.length > this.maxHistoryItems) {
            this.commandHistory = this.commandHistory.slice(0, this.maxHistoryItems);
        }
        
        // Update UI
        this.updateHistoryDisplay();
    }
    
    updateHistoryDisplay() {
        const historyEl = document.getElementById('history-list');
        if (!historyEl) return;
        
        // Clear current display
        historyEl.innerHTML = '';
        
        // Add history items
        this.commandHistory.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'history-item';
            itemEl.textContent = item.command;
            
            // Add tooltip with description
            const tooltip = document.createElement('span');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.getCommandDescription(item.command);
            itemEl.appendChild(tooltip);
            
            // Check if command was optimal (we'll enhance this later)
            if (this.isOptimalCommand(item.command)) {
                itemEl.classList.add('optimal');
            }
            
            historyEl.appendChild(itemEl);
        });
    }
    
    getCommandDescription(command) {
        // Basic command descriptions
        const descriptions = {
            'x': 'Delete character',
            'dd': 'Delete line',
            'dw': 'Delete word',
            'w': 'Jump to next word',
            'b': 'Jump to previous word',
            'h': 'Move left',
            'l': 'Move right',
            'j': 'Move down',
            'k': 'Move up',
            '0': 'Jump to line start',
            '$': 'Jump to line end',
            'i': 'Insert mode',
            'a': 'Append mode',
            'o': 'New line below',
            'O': 'New line above',
            'u': 'Undo',
            'r': 'Replace character',
            'yy': 'Yank line',
            'p': 'Paste'
        };
        
        // Check for count + command patterns
        const match = command.match(/^(\d+)(.+)$/);
        if (match) {
            const count = match[1];
            const baseCommand = match[2];
            const baseDesc = descriptions[baseCommand];
            if (baseDesc) {
                return `${baseDesc} × ${count}`;
            }
        }
        
        return descriptions[command] || command;
    }
    
    isOptimalCommand(command) {
        // For now, consider commands with counts as optimal
        // This will be enhanced with exercise-specific checks later
        return /^\d+\w/.test(command);
    }

    setupEventListeners() {
        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetExercise();
        });

        // Check button
        document.getElementById('check-btn').addEventListener('click', () => {
            this.checkExerciseCompletion(true);
        });

        // Next exercise button (in modal)
        document.getElementById('next-exercise-btn').addEventListener('click', () => {
            this.nextExercise();
        });

        // Track all keyboard events for visual feedback
        document.addEventListener('keydown', (e) => {
            this.showKeyPress(e.key);
        });
    }

    loadExercise() {
        this.currentExercise = this.exerciseLoader.getCurrentExercise();
        if (!this.currentExercise) {
            console.error('No exercise available');
            return;
        }

        console.log('Loading exercise:', this.currentExercise);

        // Reset state
        this.keyPressHistory = [];
        this.exerciseStartTime = Date.now();
        this.allowedKeys = this.currentExercise.allowedKeys;
        
        // Clear motion tracking
        this.currentMotionBuffer = [];
        this.commandHistory = [];
        this.updateMotionDisplay('');
        this.updateHistoryDisplay();

        // Set editor content
        this.editor.setValue(this.currentExercise.startText);
        this.editor.setCursor(0, 0);
        
        // Clear undo history to prevent undoing past exercises
        this.editor.clearHistory();

        // Update UI with exercise info
        this.updateExerciseUI();
        
        // Hide success modal
        this.hideSuccessModal();
    }

    updateExerciseUI() {
        if (!this.currentExercise) return;

        // Update title and instructions
        document.getElementById('exercise-title').textContent = this.currentExercise.title;
        document.getElementById('instructions').textContent = this.currentExercise.instructions;

        // Update keyboard hints dynamically based on exercise
        const hints = this.currentExercise.hintKeys;
        const keyboardHints = document.querySelector('.keyboard-hints');
        
        if (hints && hints.length > 0) {
            // Build dynamic hint text based on the exercise
            let hintHTML = '<span class="hint-text">Hint: Use</span> ';
            hints.forEach((key, index) => {
                if (index > 0) {
                    hintHTML += ' <span class="hint-text">or</span> ';
                }
                hintHTML += `<kbd>${key}</kbd>`;
            });
            keyboardHints.innerHTML = hintHTML;
        }
        
        // Update action instruction - just use the exercise instructions directly
        const actionInstruction = document.getElementById('action-instruction');
        actionInstruction.textContent = '';

        // Update progress
        this.updateProgressUI();
    }

    updateProgressUI() {
        const chapter = this.exerciseLoader.getCurrentChapter();
        
        // Update exercise counter
        document.getElementById('current-exercise').textContent = 
            this.exerciseLoader.currentExerciseIndex + 1;
        document.getElementById('total-exercises').textContent = 
            chapter ? chapter.exercises.length : 0;
    }

    updateUI() {
        this.updateExerciseUI();
        this.updateProgressUI();
    }

    checkExerciseCompletion(isManualCheck = false) {
        if (!this.currentExercise) return;

        const currentText = this.editor.getValue().trim();
        const targetText = this.currentExercise.endText.trim();

        if (currentText === targetText) {
            this.onExerciseComplete();
        } else if (isManualCheck) {
            // Show feedback for failed manual check
            this.showCheckFeedback(false);
        }
    }

    onExerciseComplete() {
        // Show success feedback first
        this.showCheckFeedback(true);
        
        // Check if user used the optimal command (if specified)
        if (this.currentExercise.optimalKeySequence) {
            const usedOptimal = this.checkIfUsedOptimalCommand();
            if (!usedOptimal) {
                this.showOptimalCommandHint();
                // Don't advance - let user retry with the optimal command
                return;
            }
        }
        
        // Update progress
        const chapter = this.exerciseLoader.getCurrentChapter();
        if (chapter) {
            chapter.completed = Math.min(chapter.completed + 1, chapter.total);
        }

        // Save progress to localStorage
        this.saveProgress();

        // Auto-advance to next exercise after a short delay
        setTimeout(() => {
            this.nextExercise();
        }, 800); // Reduced from 1500ms to 800ms for faster flow
    }
    
    showCheckFeedback(isSuccess) {
        const feedback = document.createElement('div');
        feedback.className = isSuccess ? 'check-feedback success' : 'check-feedback failure';
        
        if (isSuccess) {
            feedback.innerHTML = `
                <div class="feedback-content">
                    <div class="feedback-icon">✓</div>
                    <div class="feedback-text">Correct!</div>
                </div>
            `;
        } else {
            feedback.innerHTML = `
                <div class="feedback-content">
                    <div class="feedback-icon">✗</div>
                    <div class="feedback-text">Not quite right yet</div>
                    <div class="feedback-hint">Keep trying or use the Reset button</div>
                </div>
            `;
        }
        
        document.body.appendChild(feedback);
        
        // Remove after delay
        setTimeout(() => {
            feedback.remove();
        }, isSuccess ? 1200 : 3000);
    }
    
    checkIfUsedOptimalCommand() {
        if (!this.currentExercise.optimalKeySequence) return true;
        
        const optimalCommand = this.currentExercise.optimalKeySequence.join('');
        
        // Check if the optimal command was used in the command history
        return this.commandHistory.some(item => 
            item.command === optimalCommand
        );
    }
    
    showOptimalCommandHint() {
        const hint = document.createElement('div');
        hint.className = 'optimal-hint';
        hint.innerHTML = `
            <div class="hint-content">
                <p>Good job reaching the goal! But try using the more efficient command:</p>
                <kbd>${this.currentExercise.optimalKeySequence.join('')}</kbd>
                <p class="hint-small">Reset the exercise and try again!</p>
            </div>
        `;
        document.body.appendChild(hint);
        
        setTimeout(() => {
            hint.remove();
        }, 5000);
    }

    showSuccessModal() {
        // Show a brief success message instead of modal
        const successMsg = document.createElement('div');
        successMsg.className = 'success-flash';
        successMsg.textContent = '✓ Excellent!';
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
            successMsg.remove();
        }, 1500);
    }

    hideSuccessModal() {
        const modal = document.getElementById('success-modal');
        modal.classList.remove('show');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }

    onKeyPress(key) {
        // Simply track all keys without restrictions
        this.keyPressHistory.push({
            key: key,
            timestamp: Date.now()
        });

        // Visual feedback
        this.showKeyPress(key);
    }

    showKeyPress(key) {
        // Create a temporary element to show the key press
        const keyDisplay = document.createElement('div');
        keyDisplay.className = 'key-press-display';
        keyDisplay.textContent = key;
        document.body.appendChild(keyDisplay);

        // Remove after animation
        setTimeout(() => {
            keyDisplay.remove();
        }, 1000);
    }


    onVimModeChange(e) {
        // Could update UI to show current vim mode
        console.log('Vim mode:', e.mode);
    }

    resetExercise() {
        if (this.currentExercise) {
            this.editor.setValue(this.currentExercise.startText);
            this.editor.setCursor(0, 0);
            this.editor.clearHistory();
            this.keyPressHistory = [];
            this.exerciseStartTime = Date.now();
            
            // Clear motion display
            this.currentMotionBuffer = [];
            this.updateMotionDisplay('');
        }
    }

    nextExercise() {
        if (this.exerciseLoader.nextExercise()) {
            this.loadExercise();
        } else {
            // All exercises complete!
            this.showCompletionMessage();
        }
    }

    previousExercise() {
        if (this.exerciseLoader.previousExercise()) {
            this.loadExercise();
        }
    }

    nextChapter() {
        if (this.exerciseLoader.currentChapterIndex < this.exerciseLoader.chapters.length - 1) {
            this.exerciseLoader.currentChapterIndex++;
            this.exerciseLoader.currentExerciseIndex = 0;
            this.exerciseLoader.exercises = this.exerciseLoader.chapters[this.exerciseLoader.currentChapterIndex].exercises;
            this.loadExercise();
        }
    }

    previousChapter() {
        if (this.exerciseLoader.currentChapterIndex > 0) {
            this.exerciseLoader.currentChapterIndex--;
            this.exerciseLoader.currentExerciseIndex = 0;
            this.exerciseLoader.exercises = this.exerciseLoader.chapters[this.exerciseLoader.currentChapterIndex].exercises;
            this.loadExercise();
        }
    }

    showCompletionMessage() {
        const modal = document.getElementById('success-modal');
        modal.querySelector('h2').textContent = 'Congratulations! 🏆';
        modal.querySelector('p').textContent = 'You\'ve completed all exercises!';
        document.getElementById('next-exercise-btn').style.display = 'none';
        this.showSuccessModal();
    }

    saveProgress() {
        const progress = {
            currentChapter: this.exerciseLoader.currentChapterIndex,
            currentExercise: this.exerciseLoader.currentExerciseIndex,
            chaptersProgress: this.exerciseLoader.chapters.map(ch => ({
                id: ch.id,
                completed: ch.completed
            }))
        };
        localStorage.setItem('vim-game-progress', JSON.stringify(progress));
    }

    loadProgress() {
        const saved = localStorage.getItem('vim-game-progress');
        if (saved) {
            try {
                const progress = JSON.parse(saved);
                this.exerciseLoader.currentChapterIndex = progress.currentChapter || 0;
                this.exerciseLoader.currentExerciseIndex = progress.currentExercise || 0;
                
                // Restore chapter progress
                if (progress.chaptersProgress) {
                    progress.chaptersProgress.forEach(chProg => {
                        const chapter = this.exerciseLoader.chapters.find(ch => ch.id === chProg.id);
                        if (chapter) {
                            chapter.completed = chProg.completed || 0;
                        }
                    });
                }
            } catch (e) {
                console.error('Could not load progress:', e);
            }
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    const game = new VimGame();
    await game.init();
});