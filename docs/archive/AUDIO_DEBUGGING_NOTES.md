# Audio Debugging Notes

## Date: January 28, 2026

### Status
- ✅ **Master branch**: Audio works correctly
- ❌ **Feature branch** (`feature/mode-scaffolding`): Audio does not play

### What We Know

1. **Master branch** has a simpler, single-mode architecture where audio works
2. **Feature branch** has a three-mode architecture (Library/Test/Analysis) where audio doesn't work
3. The `loadSound` code looks identical between branches
4. The issue is likely related to:
   - p5.js sketch initialization timing
   - Container availability when sketch initializes
   - Function reference (`loadAudioFileFunction`) not being set correctly

### Key Differences

#### Master Branch
- Single file list container
- Simple initialization: `setupP5Sketch()` called once on page load
- p5 container always exists: `#p5-container`

#### Feature Branch
- Multiple mode containers (Library/Test/Analysis)
- Mode switching changes which containers are visible
- p5 container might not exist when sketch tries to initialize
- `setupP5Sketch()` might be called before containers are ready

### Next Steps to Fix Feature Branch

1. **Check initialization order**:
   - Ensure `setupP5Sketch()` is called after mode containers are created
   - Verify `#p5-container` exists when sketch initializes

2. **Check container availability**:
   - In feature branch, verify the p5 container exists in Library mode
   - Check if container is hidden/removed during mode switching

3. **Check function reference**:
   - Verify `loadAudioFileFunction` is set correctly
   - Add logging to confirm function is available when `loadAudio()` is called

4. **Test incrementally**:
   - Start with master branch
   - Add mode switching without changing audio code
   - Test audio after each change

### Commands

```bash
# Switch to master (working version)
git checkout master

# Switch to feature branch
git checkout feature/mode-scaffolding

# Compare audio loading code
git diff master feature/mode-scaffolding -- app.js | grep -A 20 "loadSound\|loadAudio"

# See what changed in setupP5Sketch
git diff master feature/mode-scaffolding -- app.js | grep -A 30 "setupP5Sketch"
```
