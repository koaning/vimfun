# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based Vim training game that teaches users Vim movements and commands through interactive exercises. It uses CodeMirror with Vim keybindings to provide an in-browser Vim experience.

## Development Commands

### Running the Application
```bash
# Start a local development server (uses Python's built-in server)
python3 -m http.server 8000

# Alternative: If Python 2 is available
python -m SimpleHTTPServer 8000
```

Then open http://localhost:8000 in your browser.

## Architecture

### Core Components

- **index.html**: Main entry point, loads CodeMirror editor with Vim mode and game scripts
- **js/exercise-loader.js**: Handles loading exercise chapters and individual exercises from markdown files
- **js/game.js**: Main game logic including editor setup, exercise verification, and progress tracking
- **css/style.css**: All styling for the application

### Exercise System

Exercises are stored as markdown files in `exercises/[chapter-name]/[exercise-name].md` with YAML frontmatter containing:
- `title`: Exercise display name
- `instructions`: User-facing instructions
- `allowed_keys`: Array of keys user can use
- `hint_keys`: Keys to highlight in the UI

Each exercise file contains:
- `## Start` section with initial editor state
- `## End` section with target state for completion

Chapters have a `chapter.yaml` file with metadata (title, description, icon, prerequisite).

### Key Technologies

- **CodeMirror 5.65.2**: Editor component with Vim keymap
- **js-yaml**: For parsing YAML frontmatter in exercises
- Uses CDN-hosted dependencies (no npm/build process required)