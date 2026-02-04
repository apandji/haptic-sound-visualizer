/**
 * TrialTagsSurvey Component
 * 
 * Multi-select survey for trial tags after each trial.
 * Loads tags from config file.
 */

class TrialTagsSurvey {
    /**
     * Create a TrialTagsSurvey instance
     * @param {Object} options - Configuration options
     * @param {string} [options.containerId] - Container ID (optional, can append to existing element)
     * @param {HTMLElement} [options.container] - Container element (optional)
     * @param {Function} [options.onComplete] - Callback when survey is completed: (selectedTags) => void
     * @param {string} [options.configPath='js/modules/trialTagsConfig.json'] - Path to tags config file
     * @param {Object} [options.pattern] - Pattern file object for audio playback
     * @param {Function} [options.onPlayAudio] - Callback to play audio: (pattern) => void
     * @param {Function} [options.onPauseAudio] - Callback to pause/stop audio: () => void
     */
    constructor(options = {}) {
        this.containerId = options.containerId;
        this.container = options.container || (this.containerId ? document.getElementById(this.containerId) : null);
        this.onComplete = options.onComplete || null;
        this.configPath = options.configPath || 'js/modules/trialTagsConfig.json';
        this.pattern = options.pattern || null;
        this.onPlayAudio = options.onPlayAudio || null;
        this.onPauseAudio = options.onPauseAudio || null;

        // State
        this.selectedTags = new Set();
        this.customTags = new Set(); // Store custom user-created tags
        this.tags = [];
        this.question = '';
        this.isLoaded = false;
        this.isPlaying = false; // Track audio playback state
        this.playButton = null; // Reference to play button element

        if (!this.container) {
            console.error('TrialTagsSurvey: Container not found');
            return;
        }

        this.init();
    }

    /**
     * Initialize the survey
     */
    async init() {
        await this.loadConfig();
        this.render();
    }

    /**
     * Load tags configuration from JSON file
     */
    async loadConfig() {
        try {
            const response = await fetch(this.configPath);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.statusText}`);
            }
            const config = await response.json();
            
            // Remove comment fields
            const { _comment, ...cleanConfig } = config;
            
            this.question = cleanConfig.question || 'What did this pattern feel like?';
            this.tags = cleanConfig.tags || [];
            this.isLoaded = true;
        } catch (error) {
            console.error('TrialTagsSurvey: Error loading config:', error);
            // Fallback to default tags
            this.question = 'What did this pattern feel like?';
            this.tags = [
                { id: 'A', label: 'A', description: 'Tag A' },
                { id: 'B', label: 'B', description: 'Tag B' },
                { id: 'C', label: 'C', description: 'Tag C' },
                { id: 'D', label: 'D', description: 'Tag D' }
            ];
            this.isLoaded = true;
        }
    }

    /**
     * Render the survey
     */
    render() {
        if (!this.isLoaded) {
            this.container.innerHTML = '<div class="trial-tags-survey__loading">Loading survey...</div>';
            return;
        }

        this.container.innerHTML = '';
        this.container.className = 'trial-tags-survey';

        // Header Section: Question + Play Button
        const headerSection = document.createElement('div');
        headerSection.className = 'trial-tags-survey__header';
        this.container.appendChild(headerSection);

        const questionContainer = document.createElement('div');
        questionContainer.className = 'trial-tags-survey__question-container';
        headerSection.appendChild(questionContainer);

        const questionEl = document.createElement('div');
        questionEl.className = 'trial-tags-survey__question';
        questionEl.textContent = this.question;
        questionContainer.appendChild(questionEl);

        // Play button (if pattern is provided) - inline with question
        if (this.pattern && this.onPlayAudio) {
            const playButtonContainer = document.createElement('div');
            playButtonContainer.className = 'trial-tags-survey__play-container';
            questionContainer.appendChild(playButtonContainer);

            const playButton = document.createElement('button');
            playButton.className = 'trial-tags-survey__play-btn';
            playButton.type = 'button';
            this.playButton = playButton;
            this.updatePlayButtonUI();
            
            playButton.addEventListener('click', () => {
                this.handlePlayPause();
            });
            playButtonContainer.appendChild(playButton);
        }

        // Instructions
        const instructionsEl = document.createElement('div');
        instructionsEl.className = 'trial-tags-survey__instructions';
        instructionsEl.textContent = 'Select one or more options that describe how this pattern feels';
        headerSection.appendChild(instructionsEl);

        // Tags Section
        const tagsSection = document.createElement('div');
        tagsSection.className = 'trial-tags-survey__tags-section';
        this.container.appendChild(tagsSection);

        // Tags container
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'trial-tags-survey__tags';
        tagsSection.appendChild(tagsContainer);

        // Create tag buttons
        this.tags.forEach(tag => {
            const tagButton = document.createElement('button');
            tagButton.className = 'trial-tags-survey__tag';
            tagButton.type = 'button';
            tagButton.dataset.tagId = tag.id;
            tagButton.textContent = tag.label;
            
            if (tag.description && tag.description !== tag.label) {
                tagButton.title = tag.description;
            }

            tagButton.addEventListener('click', () => {
                this.toggleTag(tag.id, tagButton);
            });

            tagsContainer.appendChild(tagButton);
        });

        // Custom tag input section (within tags section)
        const customTagSection = document.createElement('div');
        customTagSection.className = 'trial-tags-survey__custom-section';
        tagsSection.appendChild(customTagSection);

        const customTagLabel = document.createElement('label');
        customTagLabel.className = 'trial-tags-survey__custom-label';
        customTagLabel.textContent = 'Or add your own:';
        customTagSection.appendChild(customTagLabel);

        const customTagInputContainer = document.createElement('div');
        customTagInputContainer.className = 'trial-tags-survey__custom-input-container';
        customTagSection.appendChild(customTagInputContainer);

        const customTagInput = document.createElement('input');
        customTagInput.className = 'trial-tags-survey__custom-input';
        customTagInput.type = 'text';
        customTagInput.placeholder = 'Enter custom tag...';
        customTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && customTagInput.value.trim()) {
                this.addCustomTag(customTagInput.value.trim(), customTagInputContainer);
                customTagInput.value = '';
            }
        });
        customTagInputContainer.appendChild(customTagInput);

        const customTagAddBtn = document.createElement('button');
        customTagAddBtn.className = 'trial-tags-survey__custom-add-btn';
        customTagAddBtn.type = 'button';
        customTagAddBtn.textContent = 'Add';
        customTagAddBtn.addEventListener('click', () => {
            if (customTagInput.value.trim()) {
                this.addCustomTag(customTagInput.value.trim(), customTagInputContainer);
                customTagInput.value = '';
            }
        });
        customTagInputContainer.appendChild(customTagAddBtn);

        // Display existing custom tags
        this.customTagsContainer = customTagInputContainer;

        // Submit button is now in top-right of overlay, but we still need to track state
        // Store reference for enabling/disabling the overlay's NEXT button
        this.submitButtonRef = null; // Will be set by overlay

        // Update submit button state (will update overlay's NEXT button)
        this.updateSubmitButton();
    }

    /**
     * Handle play/pause button click
     */
    handlePlayPause() {
        if (!this.pattern || !this.onPlayAudio) return;

        if (this.isPlaying) {
            // Pause audio - need to stop via callback
            if (this.onPauseAudio) {
                this.onPauseAudio();
            }
            this.isPlaying = false;
        } else {
            // Play audio
            this.onPlayAudio(this.pattern);
            this.isPlaying = true;
        }
        this.updatePlayButtonUI();
    }

    /**
     * Update play button state (called externally when audio state changes)
     * @param {boolean} isPlaying - Whether audio is currently playing
     */
    setPlayingState(isPlaying) {
        this.isPlaying = isPlaying;
        this.updatePlayButtonUI();
    }

    /**
     * Update play button UI based on current state
     */
    updatePlayButtonUI() {
        if (!this.playButton) return;

        if (this.isPlaying) {
            // Show pause icon
            this.playButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="heroicon-pause">
                    <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" />
                </svg>
            `;
            this.playButton.setAttribute('aria-label', 'Pause audio');
            this.playButton.title = 'Pause';
        } else {
            // Show play icon
            this.playButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="heroicon-play">
                    <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" />
                </svg>
            `;
            this.playButton.setAttribute('aria-label', 'Play audio');
            this.playButton.title = 'Play';
        }
    }

    /**
     * Toggle tag selection
     * @param {string} tagId - Tag ID
     * @param {HTMLElement} button - Tag button element
     */
    toggleTag(tagId, button) {
        if (this.selectedTags.has(tagId)) {
            this.selectedTags.delete(tagId);
            button.classList.remove('selected');
        } else {
            this.selectedTags.add(tagId);
            button.classList.add('selected');
        }

        this.updateSubmitButton();
    }

    /**
     * Add a custom tag
     * @param {string} tagText - Custom tag text
     * @param {HTMLElement} container - Container to add tag button to
     */
    addCustomTag(tagText, container) {
        if (!tagText || tagText.trim() === '') return;

        // Create unique ID for custom tag
        const customTagId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Add to selected tags
        this.selectedTags.add(customTagId);
        this.customTags.add(customTagId);

        // Create tag button (similar to predefined tags)
        const tagButton = document.createElement('button');
        tagButton.className = 'trial-tags-survey__tag trial-tags-survey__tag--custom';
        tagButton.type = 'button';
        tagButton.dataset.tagId = customTagId;
        tagButton.dataset.customText = tagText;
        tagButton.textContent = tagText;
        tagButton.classList.add('selected'); // Custom tags are auto-selected

        // Add remove button for custom tags
        const removeBtn = document.createElement('span');
        removeBtn.className = 'trial-tags-survey__tag-remove';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeCustomTag(customTagId, tagButton);
        });
        tagButton.appendChild(removeBtn);

        tagButton.addEventListener('click', () => {
            this.toggleTag(customTagId, tagButton);
        });

        // Insert before the input container
        const tagsContainer = this.container.querySelector('.trial-tags-survey__tags');
        if (tagsContainer) {
            tagsContainer.appendChild(tagButton);
        }

        this.updateSubmitButton();
    }

    /**
     * Remove a custom tag
     * @param {string} tagId - Tag ID to remove
     * @param {HTMLElement} button - Tag button element
     */
    removeCustomTag(tagId, button) {
        this.selectedTags.delete(tagId);
        this.customTags.delete(tagId);
        if (button && button.parentElement) {
            button.remove();
        }
        this.updateSubmitButton();
    }

    /**
     * Update submit button enabled state
     * Also updates the overlay's NEXT button if available
     */
    updateSubmitButton() {
        // Update overlay's NEXT button if available
        const overlayNextBtn = document.querySelector('.test-execution-overlay__next-btn');
        if (overlayNextBtn) {
            overlayNextBtn.disabled = this.selectedTags.size === 0;
        }
    }

    /**
     * Set reference to overlay's NEXT button for state management
     * @param {HTMLElement} button - The overlay's NEXT button element
     */
    setOverlayNextButton(button) {
        this.submitButtonRef = button;
        this.updateSubmitButton();
    }

    /**
     * Submit the survey
     */
    submit() {
        if (this.selectedTags.size === 0) {
            // Should not happen due to disabled button, but check anyway
            console.warn('TrialTagsSurvey: Cannot submit without selecting at least one tag');
            return;
        }

        // Build array of selected tags with custom tag text
        const selectedTagsArray = Array.from(this.selectedTags).map(tagId => {
            // Check if it's a custom tag
            const customTagButton = this.container.querySelector(`[data-tag-id="${tagId}"].trial-tags-survey__tag--custom`);
            if (customTagButton) {
                return {
                    id: tagId,
                    label: customTagButton.dataset.customText || customTagButton.textContent.replace('×', '').trim(),
                    isCustom: true
                };
            } else {
                // Predefined tag - find the tag object
                const tag = this.tags.find(t => t.id === tagId);
                return tag ? {
                    id: tag.id,
                    label: tag.label,
                    isCustom: false
                } : { id: tagId, label: tagId, isCustom: false };
            }
        });
        
        if (this.onComplete) {
            this.onComplete(selectedTagsArray);
        }
    }

    /**
     * Reset the survey
     */
    reset() {
        this.selectedTags.clear();
        this.customTags.clear();
        this.isPlaying = false;
        this.updatePlayButtonUI();
        const tagButtons = this.container.querySelectorAll('.trial-tags-survey__tag');
        tagButtons.forEach(button => {
            button.classList.remove('selected');
            // Remove custom tags
            if (button.classList.contains('trial-tags-survey__tag--custom')) {
                button.remove();
            }
        });
        // Clear custom input
        const customInput = this.container.querySelector('.trial-tags-survey__custom-input');
        if (customInput) {
            customInput.value = '';
        }
        this.updateSubmitButton();
    }

    /**
     * Get selected tags
     * @returns {Array<Object>} Array of selected tag objects with id, label, and isCustom flag
     */
    getSelectedTags() {
        return Array.from(this.selectedTags).map(tagId => {
            // Check if it's a custom tag
            const customTagButton = this.container.querySelector(`[data-tag-id="${tagId}"].trial-tags-survey__tag--custom`);
            if (customTagButton) {
                return {
                    id: tagId,
                    label: customTagButton.dataset.customText || customTagButton.textContent.replace('×', '').trim(),
                    isCustom: true
                };
            } else {
                // Predefined tag - find the tag object
                const tag = this.tags.find(t => t.id === tagId);
                return tag ? {
                    id: tag.id,
                    label: tag.label,
                    isCustom: false
                } : { id: tagId, label: tagId, isCustom: false };
            }
        });
    }
}
