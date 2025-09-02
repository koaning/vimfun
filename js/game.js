class VimGame {
    constructor() {
        this.editor = null;
        this.exerciseLoader = new ExerciseLoader();
        this.currentExercise = null;
        this.allowedKeys = [];
        this.keyPressHistory = [];
        this.exerciseStartTime = null;
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
                "Alt-LeftClick": function() { return false; }
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

        // Track content changes
        this.editor.on('change', () => {
            this.checkExerciseCompletion();
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

        // Override some vim commands to track them
        CodeMirror.Vim.defineAction('monitored-x', (cm, args, vim) => {
            this.onKeyPress('x');
            // Perform the actual delete
            const pos = cm.getCursor();
            const line = cm.getLine(pos.line);
            if (pos.ch < line.length) {
                cm.replaceRange('', pos, {line: pos.line, ch: pos.ch + 1});
            }
        });
        CodeMirror.Vim.mapCommand('x', 'action', 'monitored-x', {}, {context: 'normal'});

        // Track undo
        CodeMirror.Vim.defineAction('monitored-u', (cm, args, vim) => {
            this.onKeyPress('u');
            cm.undo();
        });
        CodeMirror.Vim.mapCommand('u', 'action', 'monitored-u', {}, {context: 'normal'});
    }

    setupEventListeners() {
        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetExercise();
        });

        // Next exercise button (in modal)
        document.getElementById('next-exercise-btn').addEventListener('click', () => {
            this.nextExercise();
        });

        // Chapter navigation
        document.getElementById('prev-chapter').addEventListener('click', () => {
            this.previousChapter();
        });

        document.getElementById('next-chapter').addEventListener('click', () => {
            this.nextChapter();
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

        // Reset state
        this.keyPressHistory = [];
        this.exerciseStartTime = Date.now();
        this.allowedKeys = this.currentExercise.allowedKeys;

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
            // Build dynamic hint text
            let hintHTML = '<span class="hint-text">You can use the</span> ';
            hints.forEach((key, index) => {
                if (index > 0) {
                    hintHTML += ' <span class="hint-text">and</span> ';
                }
                hintHTML += `<kbd>${key}</kbd>`;
            });
            hintHTML += ' <span class="hint-text">keys to move the cursor.</span>';
            keyboardHints.innerHTML = hintHTML;
        }
        
        // Update action instruction based on exercise
        const actionInstruction = document.getElementById('action-instruction');
        if (this.currentExercise.instructions.includes('delete')) {
            actionInstruction.innerHTML = 
                `Move on top of the <kbd>%</kbd> character. Then press the <kbd>x</kbd> key to remove it.`;
        } else {
            actionInstruction.innerHTML = this.currentExercise.instructions;
        }

        // Update progress
        this.updateProgressUI();
    }

    updateProgressUI() {
        const chapter = this.exerciseLoader.getCurrentChapter();
        const progress = this.exerciseLoader.getProgress();
        
        // Update exercise counter
        document.getElementById('current-exercise').textContent = 
            this.exerciseLoader.currentExerciseIndex + 1;
        document.getElementById('total-exercises').textContent = 
            chapter ? chapter.exercises.length : 0;

        // Update chapter name
        document.getElementById('chapter-name').textContent = 
            chapter ? `Chapter ${this.exerciseLoader.currentChapterIndex + 1}: ${chapter.title}` : '';

        // Update navigation buttons
        document.getElementById('prev-chapter').disabled = 
            this.exerciseLoader.currentChapterIndex === 0;
        document.getElementById('next-chapter').disabled = 
            this.exerciseLoader.currentChapterIndex >= this.exerciseLoader.chapters.length - 1;
    }

    updateUI() {
        this.updateExerciseUI();
        this.updateProgressUI();
    }

    checkExerciseCompletion() {
        if (!this.currentExercise) return;

        const currentText = this.editor.getValue().trim();
        const targetText = this.currentExercise.endText.trim();

        if (currentText === targetText) {
            this.onExerciseComplete();
        }
    }

    onExerciseComplete() {
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
        }, 1500);
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
        // Always allow arrow keys and escape
        const alwaysAllowed = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'];
        
        // Check if key is allowed
        if (this.allowedKeys.length > 0 && 
            !this.allowedKeys.includes(key) && 
            !alwaysAllowed.includes(key)) {
            this.showKeyWarning(key);
            return;
        }

        // Add to history
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

    showKeyWarning(key) {
        // Flash a warning for disallowed keys
        const warning = document.createElement('div');
        warning.className = 'key-warning';
        warning.textContent = `Key '${key}' is not allowed in this exercise`;
        document.body.appendChild(warning);

        setTimeout(() => {
            warning.remove();
        }, 2000);
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