# Vim Training Game Enhancement Plan

## Problem Statement
1. Limited exercise variety (only 1-2 exercises per vim command)
2. No verification that users actually use intended shortcuts
3. Users can bypass intended methods (e.g., using arrow keys instead of h/l, or x x x instead of 3x)
4. No real-time feedback showing current vim motion being typed

## Proposed Solutions

### Phase 1: Real-Time Motion Display
**Goal**: Show users what vim command they're currently typing

- Access `editor.state.vim.inputState.keyBuffer` to get current motion buffer
- Create a status bar component showing:
  - Current motion being typed (e.g., "3x" as user types it)
  - Visual distinction between counts, operators, and motions
  - Clear display when command executes
- Position options:
  - Fixed bottom status bar
  - Floating near cursor
  - Top panel with command buffer

### Phase 2: Key Sequence Verification System
**Goal**: Verify users use the intended shortcuts

- Capture complete command sequences (not just individual keys)
- Add to exercise format:
  ```yaml
  optimalKeySequence: ["3", "x"]  # Must use 3x
  forbiddenSequences: [["x", "x", "x"]]  # Can't use x three times
  ```
- Compare user's actual sequence with optimal
- Provide immediate feedback:
  - ✅ "Great! You used 3x"
  - ⚠️ "Try using 3x instead of pressing x three times"
  - ❌ "This exercise requires using the x command"

### Phase 3: Command History & Analytics
**Goal**: Show learning progress and efficiency

- Scrolling command history showing last N commands
- For each command show:
  - The keys pressed
  - What it did (tooltip/description)
  - Efficiency indicator (optimal/suboptimal)
- Session statistics:
  - Total keystrokes vs optimal
  - Commands learned
  - Efficiency percentage

### Phase 4: Exercise Variety
**Goal**: More practice per concept

For each vim command, create multiple exercises:
- Different positions (start/middle/end of line)
- Different contexts (words, code, URLs, markdown)
- Progressive difficulty
- Example for 'x' command:
  1. Delete single character at end
  2. Delete character in middle of word  
  3. Delete 3 characters using 3x
  4. Delete 5 characters efficiently
  5. Delete special characters
  6. Delete in code context

## Implementation Details

### UI Components to Add

1. **Motion Display Panel**
   ```html
   <div class="vim-motion-display">
     <span class="motion-label">Current:</span>
     <span class="motion-buffer">3x</span>
   </div>
   ```

2. **Command History**
   ```html
   <div class="command-history">
     <div class="command-item optimal">dd - deleted line</div>
     <div class="command-item suboptimal">xxx - deleted 3 chars (try 3x)</div>
   </div>
   ```

3. **Efficiency Score**
   ```html
   <div class="efficiency-meter">
     <div class="score">85% efficient</div>
     <div class="comparison">
       Your way: 12 keystrokes | Optimal: 10 keystrokes
     </div>
   </div>
   ```

### Technical Approach

1. **Accessing Vim State**
   ```javascript
   // In game.js
   const vimState = this.editor.state.vim;
   const currentMotion = vimState.inputState.keyBuffer.join('');
   ```

2. **Tracking Complete Commands**
   ```javascript
   // Track when keyBuffer is cleared (command executed)
   let lastBuffer = [];
   this.editor.on('vim-command-done', () => {
     const command = lastBuffer.join('');
     this.verifyCommand(command);
   });
   ```

3. **Exercise Verification**
   ```javascript
   verifyCommand(command) {
     if (this.currentExercise.optimalKeySequence) {
       const isOptimal = command === this.currentExercise.optimalKeySequence.join('');
       this.showFeedback(isOptimal);
     }
   }
   ```

## Testing Strategy

### Unit Testing Approach

1. **Key Sequence Verification Tests**
   - Test that correct sequences pass
   - Test that incorrect sequences fail
   - Test partial matches don't trigger false positives

2. **Motion Buffer Display Tests**
   - Test buffer updates in real-time
   - Test buffer clears after command execution
   - Test display handles multi-character commands (10dd, 3w)

3. **Exercise Validation Tests**
   - Test all exercise files have valid YAML
   - Test start/end states are different
   - Test optimalKeySequence actually works

### Manual Testing Scenarios

1. **User Flow Tests**
   - Complete beginner path (never used vim)
   - Intermediate user trying to improve efficiency
   - Advanced user speedrunning exercises

2. **Edge Cases**
   - Rapid key presses
   - Using undo (u) during exercises
   - Switching between insert/normal modes
   - Mouse interactions (should be blocked)

3. **Visual Feedback Tests**
   - Motion display visibility/readability
   - Animation timing
   - Color contrast for feedback

### Automated Testing Tools

Since this is a vanilla JS project with no build process, testing options:
1. **QUnit** - Can be loaded via CDN like other dependencies
2. **Simple assertion functions** - Custom mini test framework
3. **Browser DevTools snippets** - For development testing

Example test structure:
```javascript
// tests.js
function testKeySequenceMatching() {
  const exercise = {
    optimalKeySequence: ['3', 'x']
  };
  
  assert(matchesOptimal(['3', 'x'], exercise), 'Optimal sequence matches');
  assert(!matchesOptimal(['x', 'x', 'x'], exercise), 'Suboptimal sequence fails');
}

function runTests() {
  testKeySequenceMatching();
  testMotionBufferDisplay();
  testExerciseCompletion();
  console.log('All tests passed!');
}
```

## Questions to Consider

1. Should we allow multiple valid solutions per exercise?
2. How strict should the verification be? (e.g., is '3x' and 'xxx' both ok for learning?)
3. Should we add a "strict mode" toggle?
4. Do we want to track metrics across sessions (localStorage)?
5. Should command history persist between exercises?

## Testing Deep Dive

### Why Test Now?
- Design for testability from the start
- Tests as living documentation
- Catch integration issues early (CodeMirror vim mode quirks)

### Test Categories

#### 1. Integration Tests (Most Important)
Test the actual vim command detection and verification:
```javascript
// Can we reliably detect "3x" vs "x x x"?
async function testCommandDetection() {
  const game = new VimGame();
  await game.init();
  
  // Simulate typing "3x"
  game.editor.state.vim.inputState.keyBuffer = ['3', 'x'];
  game.onVimCommandComplete();
  
  assert(game.lastCommand === '3x', 'Detects 3x command');
}
```

#### 2. Exercise Validation Tests
Ensure all exercises are valid:
```javascript
function validateExercises() {
  // Check YAML syntax
  // Verify start !== end
  // Test that optimalKeySequence actually solves the exercise
  // Ensure all referenced keys exist in allowedKeys
}
```

#### 3. Feedback System Tests
Test that the right feedback appears:
```javascript
function testFeedback() {
  // Optimal path shows success
  // Suboptimal shows warning
  // Wrong command shows error
  // Feedback clears appropriately
}
```

### Testing Infrastructure Options

#### Option 1: QUnit (CDN-friendly)
```html
<link rel="stylesheet" href="https://code.jquery.com/qunit/qunit-2.20.0.css">
<script src="https://code.jquery.com/qunit/qunit-2.20.0.js"></script>
<script src="tests/test-game.js"></script>
```

#### Option 2: Custom Mini Framework
```javascript
// tests/simple-test.js
const tests = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(`❌ ${message}`);
  console.log(`✅ ${message}`);
};

const test = (name, fn) => tests.push({name, fn});

const runTests = async () => {
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ ${t.name}`);
    } catch (e) {
      console.error(`✗ ${t.name}: ${e.message}`);
    }
  }
};
```

#### Option 3: Development-Only Test Page
Create `test.html` that:
- Loads the game
- Runs automated tests
- Shows visual test scenarios
- Not shipped to users

### Critical Tests to Write First

1. **Can we detect vim commands?**
   - Test that `editor.state.vim.inputState.keyBuffer` works
   - Test command completion detection
   - Test buffer clearing

2. **Exercise format validation**
   - All exercises load without errors
   - YAML frontmatter is valid
   - Required fields present

3. **Key verification logic**
   - Optimal sequences pass
   - Forbidden sequences fail  
   - Partial matches handled correctly

### Testing User Experience

Manual testing checklist:
- [ ] First-time user can understand the UI
- [ ] Motion display is readable/helpful
- [ ] Feedback appears at the right time
- [ ] No jarring transitions
- [ ] Works on different screen sizes

### Performance Testing
- Measure keystroke-to-feedback latency
- Check memory leaks from event handlers
- Verify no UI jank during animations

## Next Steps

1. [ ] Create test.html with basic test harness
2. [ ] Write tests for vim command detection
3. [ ] Implement motion display (Phase 1)
4. [ ] Add key sequence tracking (Phase 2)  
5. [ ] Create 5 exercises for 'x' command
6. [ ] Run tests after each implementation phase
7. [ ] Get user feedback on UI/UX