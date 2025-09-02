class ExerciseLoader {
    constructor() {
        this.chapters = [];
        this.currentChapterIndex = 0;
        this.currentExerciseIndex = 0;
        this.exercises = [];
    }

    async loadChapters() {
        // In a real implementation, this would dynamically scan the exercises folder
        // For now, we'll hardcode the structure
        const chapterFolders = [
            '01-basics',
            '02-words-and-lines',
            '03-visual-mode',
            '04-advanced'
        ];

        for (const folder of chapterFolders) {
            try {
                // Load chapter metadata
                const chapterMeta = await this.loadChapterMeta(folder);
                
                // Load exercises for this chapter
                const exercises = await this.loadChapterExercises(folder);
                
                this.chapters.push({
                    id: folder,
                    ...chapterMeta,
                    exercises: exercises,
                    completed: 0,
                    total: exercises.length
                });
            } catch (error) {
                console.warn(`Could not load chapter ${folder}:`, error);
            }
        }

        // Set current exercises from first chapter
        if (this.chapters.length > 0) {
            this.exercises = this.chapters[0].exercises;
        }
    }

    async loadChapterMeta(folder) {
        try {
            const response = await fetch(`exercises/${folder}/chapter.yaml`);
            const yamlText = await response.text();
            return jsyaml.load(yamlText);
        } catch (error) {
            // Return default metadata if chapter.yaml doesn't exist
            return {
                title: folder.replace(/-/g, ' ').replace(/^\d+\s/, ''),
                description: 'Practice Vim commands',
                icon: '📚'
            };
        }
    }

    async loadChapterExercises(folder) {
        // Hardcoded exercise files for now
        // In production, this would be dynamically discovered
        const exerciseFiles = this.getExerciseFiles(folder);
        const exercises = [];

        for (const file of exerciseFiles) {
            try {
                const exercise = await this.loadExercise(`exercises/${folder}/${file}`);
                exercises.push(exercise);
            } catch (error) {
                console.warn(`Could not load exercise ${file}:`, error);
            }
        }

        return exercises;
    }

    getExerciseFiles(folder) {
        // Hardcoded mapping of folders to exercise files
        const mapping = {
            '01-basics': [
                '01-first-steps.md',
                '02-delete-character.md',
                '03-undo.md'
            ],
            '02-words-and-lines': [
                '01-word-jump.md'
            ],
            '03-visual-mode': [],
            '04-advanced': []
        };

        return mapping[folder] || [];
    }

    async loadExercise(path) {
        const response = await fetch(path);
        const content = await response.text();
        return this.parseExercise(content, path);
    }

    parseExercise(content, path) {
        // Split frontmatter and content
        const parts = content.split('---');
        if (parts.length < 3) {
            throw new Error('Invalid exercise format');
        }

        // Parse frontmatter
        const frontmatter = jsyaml.load(parts[1]);

        // Parse start and end states
        const mainContent = parts.slice(2).join('---');
        const startMatch = mainContent.match(/## Start\s*```\s*([\s\S]*?)\s*```/);
        const endMatch = mainContent.match(/## End\s*```\s*([\s\S]*?)\s*```/);

        if (!startMatch || !endMatch) {
            throw new Error('Exercise must have Start and End sections');
        }

        return {
            path: path,
            title: frontmatter.title || 'Untitled Exercise',
            instructions: frontmatter.instructions || 'Complete the exercise',
            allowedKeys: frontmatter.allowed_keys || [],
            hintKeys: frontmatter.hint_keys || [],
            startText: startMatch[1].trim(),
            endText: endMatch[1].trim()
        };
    }

    getCurrentExercise() {
        const chapter = this.chapters[this.currentChapterIndex];
        if (!chapter || !chapter.exercises[this.currentExerciseIndex]) {
            return null;
        }
        return chapter.exercises[this.currentExerciseIndex];
    }

    getCurrentChapter() {
        return this.chapters[this.currentChapterIndex];
    }

    nextExercise() {
        const chapter = this.chapters[this.currentChapterIndex];
        if (!chapter) return false;

        this.currentExerciseIndex++;
        
        // Check if we've completed all exercises in this chapter
        if (this.currentExerciseIndex >= chapter.exercises.length) {
            // Move to next chapter
            if (this.currentChapterIndex < this.chapters.length - 1) {
                this.currentChapterIndex++;
                this.currentExerciseIndex = 0;
                this.exercises = this.chapters[this.currentChapterIndex].exercises;
                return true;
            }
            // No more exercises
            this.currentExerciseIndex = chapter.exercises.length - 1;
            return false;
        }
        
        return true;
    }

    previousExercise() {
        this.currentExerciseIndex--;
        
        // Check if we need to go to previous chapter
        if (this.currentExerciseIndex < 0) {
            if (this.currentChapterIndex > 0) {
                this.currentChapterIndex--;
                const prevChapter = this.chapters[this.currentChapterIndex];
                this.currentExerciseIndex = prevChapter.exercises.length - 1;
                this.exercises = prevChapter.exercises;
                return true;
            }
            // Stay at first exercise
            this.currentExerciseIndex = 0;
            return false;
        }
        
        return true;
    }

    resetCurrentExercise() {
        // Just return the current exercise's start text
        const exercise = this.getCurrentExercise();
        return exercise ? exercise.startText : '';
    }

    isChapterUnlocked(chapterIndex) {
        if (chapterIndex === 0) return true;
        
        const prevChapter = this.chapters[chapterIndex - 1];
        // Unlock if previous chapter is at least 80% complete
        return prevChapter && (prevChapter.completed / prevChapter.total) >= 0.8;
    }

    getProgress() {
        const chapter = this.getCurrentChapter();
        if (!chapter) return { current: 0, total: 0, percentage: 0 };

        const completed = this.currentExerciseIndex;
        const total = chapter.exercises.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { current: completed, total, percentage };
    }
}