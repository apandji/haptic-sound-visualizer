# Contributing Guide

Welcome! This guide will help you contribute to the Haptic Sound Visualizer project. We follow a feature branch workflow with code reviews to maintain code quality and enable collaborative development.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming Convention](#branch-naming-convention)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Review Guidelines](#code-review-guidelines)
- [Handling Conflicts](#handling-conflicts)
- [Testing Requirements](#testing-requirements)
- [Project Structure](#project-structure)

---

## Getting Started

### Prerequisites

- Git installed and configured
- Node.js (if applicable)
- Python 3.x (for running the server)
- A GitHub account with access to the repository

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/[username]/haptic-sound-visualizer.git
cd haptic-sound-visualizer

# Verify you're on master branch
git checkout master

# Pull latest changes
git pull origin master
```

---

## Development Workflow

We use a **feature branch workflow** with pull requests. Never commit directly to `master` - all changes go through feature branches and code review.

### Step-by-Step Workflow

#### 1. Start from Latest Master

Always start your work from an up-to-date `master` branch:

```bash
git checkout master
git pull origin master
```

#### 2. Create a Feature Branch

Create a new branch for your feature/fix:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

**Important:** Use descriptive branch names (see [Branch Naming Convention](#branch-naming-convention))

#### 3. Make Your Changes

- Write code
- Test your changes locally
- Update documentation if needed
- Follow the project's code style

#### 4. Stage and Commit

```bash
# Review your changes
git status
git diff

# Stage all changes
git add .

# Commit with a descriptive message
git commit -m "feat: add new feature description

- Detail 1
- Detail 2
- Detail 3"
```

See [Commit Message Guidelines](#commit-message-guidelines) for proper formatting.

#### 5. Push Feature Branch

```bash
git push origin feature/your-feature-name
```

#### 6. Create Pull Request

1. Go to the repository on GitHub
2. You'll see a banner: "feature/your-feature-name had recent pushes"
3. Click **"Compare & pull request"**
4. Fill out the PR template (see [Pull Request Process](#pull-request-process))
5. Request reviews from team members
6. Add appropriate labels

#### 7. Address Review Feedback

If reviewers request changes:

```bash
# Make the requested changes
# ... edit files ...

# Commit the fixes
git add .
git commit -m "fix: address PR review feedback

- Fix [specific issue]
- Update [specific change]"

# Push updates (PR updates automatically)
git push origin feature/your-feature-name
```

#### 8. After PR is Merged

Once your PR is approved and merged:

```bash
# Switch back to master
git checkout master

# Pull the merged changes
git pull origin master

# Delete local feature branch
git branch -d feature/your-feature-name

# Clean up remote references
git fetch --prune
```

---

## Branch Naming Convention

Use descriptive branch names with prefixes:

### Prefixes

- `feature/` - New features
  - Example: `feature/mode-scaffolding`, `feature/eeg-integration`
- `fix/` - Bug fixes
  - Example: `fix/audio-loading-bug`, `fix/mode-switching-issue`
- `refactor/` - Code refactoring
  - Example: `refactor/file-organization`, `refactor/css-structure`
- `docs/` - Documentation updates
  - Example: `docs/update-readme`, `docs/add-api-docs`
- `test/` - Adding or updating tests
  - Example: `test/add-unit-tests`
- `chore/` - Maintenance tasks
  - Example: `chore/update-dependencies`

### Naming Guidelines

- Use lowercase letters
- Separate words with hyphens (`-`)
- Be descriptive but concise
- Examples:
  - ✅ `feature/mode-scaffolding`
  - ✅ `fix/audio-playback-error`
  - ❌ `my-branch`
  - ❌ `fix-stuff`
  - ❌ `FeatureBranch`

---

## Commit Message Guidelines

We follow the **Conventional Commits** specification for consistent commit messages.

### Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `feat:` - A new feature
- `fix:` - A bug fix
- `refactor:` - Code refactoring (no feature change or bug fix)
- `docs:` - Documentation changes
- `style:` - Formatting, missing semicolons, etc. (no code change)
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks, dependency updates

### Examples

**Simple commit:**
```
fix: ensure Library mode is selected on initial load
```

**Detailed commit:**
```
feat: scaffold three-mode architecture (Library/Test/Analysis)

- Add mode navigation header with Library/Test/Analysis tabs
- Implement mode switching with hash routing (#library, #test, #analysis)
- Reorganize project files into docs/, data/, scripts/, backups/
- Move styles from index.html to css/styles.css
- Add Test Mode with file manager sidebar and test queue
- Add Analysis Mode placeholder
- Update README with new project structure
```

**Bug fix:**
```
fix: resolve audio file loading error in Test mode

- Fix file path resolution for test queue
- Add error handling for missing audio files
- Update error messages for better debugging
```

### Guidelines

- **Subject line:** Keep under 50 characters, use imperative mood ("add" not "added")
- **Body:** Explain *what* and *why*, not *how* (code shows how)
- **Wrap:** Wrap body at 72 characters
- **Be specific:** Avoid vague messages like "fix bug" or "update code"

---

## Pull Request Process

### PR Title

Use the same format as commit messages:

```
feat: Scaffold three-mode architecture (Library/Test/Analysis)
fix: Resolve audio loading error in Test mode
```

### PR Description Template

Use this template when creating a PR:

```markdown
## Description
Brief description of what this PR does and why.

## Changes
- ✅ Change 1
- ✅ Change 2
- ✅ Change 3

## Testing
- [x] Tested locally
- [x] Tested [specific scenario]
- [x] Verified [specific functionality]

## Screenshots
(If applicable, add screenshots or GIFs)

## Related
- Related to: [Issue/PR number or document]
- Part of: [Larger feature/epic]
```

### PR Checklist

Before submitting:

- [ ] Code follows project style guidelines
- [ ] Self-reviewed code
- [ ] No console errors or warnings
- [ ] Tested locally
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow guidelines
- [ ] Branch name follows convention

### Requesting Reviews

- Add reviewers: Click "Reviewers" → Select team members
- Add labels: Use appropriate labels (`feature`, `bug`, `frontend`, etc.)
- Link issues: Reference related issues using `#issue-number`

---

## Code Review Guidelines

### For Authors

- **Be responsive:** Respond to review comments promptly
- **Be open:** Accept constructive feedback gracefully
- **Ask questions:** If feedback is unclear, ask for clarification
- **Update PR:** Make requested changes and push updates
- **Mark resolved:** Mark conversations as resolved when addressed

### For Reviewers

- **Be constructive:** Provide specific, actionable feedback
- **Be respectful:** Remember we're all learning
- **Be timely:** Review PRs within 24-48 hours if possible
- **Be thorough:** Check functionality, code quality, and style
- **Approve when ready:** Don't block on minor issues

### Review Checklist

- [ ] Code works as intended
- [ ] Code follows project style
- [ ] No obvious bugs or errors
- [ ] Tests pass (if applicable)
- [ ] Documentation updated
- [ ] No security concerns
- [ ] Performance considerations addressed

---

## Handling Conflicts

If `master` has moved ahead while you're working on a feature:

### Option 1: Rebase (Recommended)

```bash
# On your feature branch
git checkout feature/your-feature-name

# Fetch latest changes
git fetch origin

# Rebase onto latest master
git rebase origin/master

# If conflicts occur, resolve them:
# 1. Git will pause at each conflict
# 2. Edit files to resolve conflicts
# 3. Stage resolved files: git add <file>
# 4. Continue rebase: git rebase --continue
# 5. Repeat until rebase completes

# Force push (use --force-with-lease for safety)
git push origin feature/your-feature-name --force-with-lease
```

### Option 2: Merge

```bash
# On your feature branch
git checkout feature/your-feature-name

# Merge latest master
git merge origin/master

# Resolve conflicts if any
# Stage resolved files
git add .

# Complete merge
git commit

# Push
git push origin feature/your-feature-name
```

**Note:** Rebase creates a cleaner history, but merge preserves the exact history of when work was done.

---

## Testing Requirements

### Before Submitting a PR

- [ ] **Manual Testing:** Test all affected functionality
- [ ] **Cross-browser:** Test in Chrome/Edge (Web Bluetooth support)
- [ ] **No Console Errors:** Check browser console for errors
- [ ] **Responsive:** Verify layout works on different screen sizes (if applicable)

### Testing Checklist

- [ ] Feature works as expected
- [ ] No regressions in existing functionality
- [ ] Error handling works correctly
- [ ] Edge cases handled appropriately
- [ ] Performance is acceptable

### Local Testing

```bash
# Start the development server
python3 server.py

# Open browser to http://localhost:8000
# Test your changes thoroughly
```

---

## Project Structure

Understanding the project structure helps with contributions:

```
haptic-sound-visualizer/
├── docs/                    # Documentation
│   ├── CONTRIBUTING.md     # This file
│   ├── EEG_INTEGRATION_BRAINSTORM.md
│   └── ...
├── data/                    # Data files (JSON metadata)
├── scripts/                 # Utility scripts (Python)
├── backups/                # Backup files
├── css/                    # Stylesheets
│   └── styles.css
├── js/                     # JavaScript modules
│   ├── ui/
│   └── visualizations/
├── audio_files/            # Audio files (not in git)
├── index.html              # Main HTML file
├── app.js                  # Main application logic
├── server.py               # Python HTTP server
└── README.md              # Project README
```

### Key Files

- `index.html` - Main HTML structure
- `app.js` - Core application logic
- `css/styles.css` - All styles (keep styles out of HTML)
- `server.py` - Development server

---

## Code Style Guidelines

### JavaScript

- Use modern ES6+ syntax
- Follow existing code style
- Use meaningful variable names
- Add comments for complex logic
- Keep functions focused and small

### CSS

- Use consistent naming conventions
- Keep styles in `css/styles.css` (not inline)
- Use meaningful class names
- Comment complex styles

### HTML

- Use semantic HTML
- Keep structure clean and readable
- Avoid inline styles (use CSS classes)

---

## Getting Help

### Questions?

- Check existing documentation in `docs/`
- Review closed PRs for examples
- Ask in PR comments
- Reach out to team members

### Found a Bug?

1. Check if it's already reported
2. Create an issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/environment info

---

## Quick Reference

### Common Commands

```bash
# Start fresh feature
git checkout master
git pull origin master
git checkout -b feature/my-feature

# Make changes, then commit
git add .
git commit -m "feat: description"

# Push and create PR
git push origin feature/my-feature

# Update feature branch with latest master
git checkout feature/my-feature
git fetch origin
git rebase origin/master

# After PR merge, clean up
git checkout master
git pull origin master
git branch -d feature/my-feature
```

---

## Best Practices

1. **Keep PRs focused:** One feature/fix per PR
2. **Write clear commits:** Future you will thank present you
3. **Test before pushing:** Don't push broken code
4. **Communicate:** Ask questions, provide context
5. **Be patient:** Code review takes time
6. **Learn:** Every PR is a learning opportunity

---

Thank you for contributing! 🎉
