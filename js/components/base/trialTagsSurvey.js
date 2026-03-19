/**
 * TrialTagsSurvey Component
 *
 * Multi-select survey for trial tags after each trial.
 * Supports multiple categories displayed as tabs.
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
        this.customTags = new Set();
        this.tagIntensities = new Map();
        this.categories = [];
        this.currentCategoryIndex = 0;
        this.question = '';
        this.isLoaded = false;
        this.isPlaying = false;
        this.playButton = null;

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

            // Support both old format (tags array) and new format (categories array)
            if (cleanConfig.categories && Array.isArray(cleanConfig.categories)) {
                this.categories = this.normalizeCategories(cleanConfig.categories);
            } else if (cleanConfig.tags && Array.isArray(cleanConfig.tags)) {
                // Legacy format: wrap in single category
                this.categories = this.normalizeCategories([{
                    id: 'default',
                    name: 'Tags',
                    description: '',
                    tags: cleanConfig.tags
                }]);
            } else {
                throw new Error('Invalid config format');
            }

            this.isLoaded = true;
        } catch (error) {
            console.error('TrialTagsSurvey: Error loading config:', error);
            // Fallback to default
            this.question = 'What did this pattern feel like?';
            this.categories = this.normalizeCategories([{
                id: 'default',
                name: 'Tags',
                description: '',
                tags: [
                    { id: 'A', label: 'A' },
                    { id: 'B', label: 'B' },
                    { id: 'C', label: 'C' },
                    { id: 'D', label: 'D' }
                ]
            }]);
            this.isLoaded = true;
        }
    }

    /**
     * Normalize category config so optional intensity settings are always present.
     * @param {Array<Object>} categories - Raw category config array
     * @returns {Array<Object>}
     */
    normalizeCategories(categories) {
        return categories.map(category => ({
            ...category,
            requiresIntensity: Boolean(category.requiresIntensity),
            intensityPrompt: category.intensityPrompt || 'Choose intensity for each selected tag.',
            intensityScale: Array.isArray(category.intensityScale) && category.intensityScale.length > 0
                ? category.intensityScale
                : [1, 2, 3, 4]
        }));
    }

    /**
     * Render the survey
     */
    render() {
        if (!this.isLoaded) {
            this.container.innerHTML = '<div class="loading-state"><div class="loading-spinner" aria-hidden="true"></div><span class="loading-text">Loading survey...</span></div>';
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

        // Play button (if pattern is provided)
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
        instructionsEl.textContent = this.categories.some(category => category.requiresIntensity)
            ? 'Select one or more options from each category. For action tags, choose an intensity before continuing.'
            : 'Select one or more options from each category';
        headerSection.appendChild(instructionsEl);

        // Category Tabs (only if more than one category)
        if (this.categories.length > 1) {
            const tabsContainer = document.createElement('div');
            tabsContainer.className = 'trial-tags-survey__tabs';
            this.container.appendChild(tabsContainer);

            this.categories.forEach((category, index) => {
                const tab = document.createElement('button');
                tab.className = 'trial-tags-survey__tab';
                tab.type = 'button';
                tab.dataset.categoryIndex = index;
                tab.textContent = category.name;

                if (index === this.currentCategoryIndex) {
                    tab.classList.add('active');
                }

                tab.addEventListener('click', () => {
                    this.switchCategory(index);
                });

                tabsContainer.appendChild(tab);
            });

            // Add selection count badges to tabs
            this.updateTabBadges();
        }

        // Category content container
        const categoryContent = document.createElement('div');
        categoryContent.className = 'trial-tags-survey__category-content';
        this.container.appendChild(categoryContent);
        this.categoryContentEl = categoryContent;

        // Render current category
        this.renderCategory(this.currentCategoryIndex);

        // Custom tag input section (shared across categories)
        const customTagSection = document.createElement('div');
        customTagSection.className = 'trial-tags-survey__custom-section';
        this.container.appendChild(customTagSection);

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
                this.addCustomTag(customTagInput.value.trim());
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
                this.addCustomTag(customTagInput.value.trim());
                customTagInput.value = '';
            }
        });
        customTagInputContainer.appendChild(customTagAddBtn);

        // Custom tags display area
        const customTagsDisplay = document.createElement('div');
        customTagsDisplay.className = 'trial-tags-survey__custom-tags';
        customTagSection.appendChild(customTagsDisplay);
        this.customTagsDisplayEl = customTagsDisplay;

        // Update submit button state
        this.updateSubmitButton();
    }

    /**
     * Render a specific category's tags
     * @param {number} index - Category index
     */
    renderCategory(index) {
        if (!this.categoryContentEl) return;

        const category = this.categories[index];
        if (!category) return;

        this.categoryContentEl.innerHTML = '';

        // Category description
        if (category.description) {
            const descEl = document.createElement('div');
            descEl.className = 'trial-tags-survey__category-desc';
            descEl.textContent = category.description;
            this.categoryContentEl.appendChild(descEl);
        }

        if (category.requiresIntensity) {
            const intensityPromptEl = document.createElement('div');
            intensityPromptEl.className = 'trial-tags-survey__intensity-prompt';
            intensityPromptEl.textContent = category.intensityPrompt;
            this.categoryContentEl.appendChild(intensityPromptEl);
        }

        // Tags container
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'trial-tags-survey__tags';
        this.categoryContentEl.appendChild(tagsContainer);

        // Create tag buttons
        category.tags.forEach(tag => {
            const isSelected = this.selectedTags.has(tag.id);
            const tagItem = document.createElement('div');
            tagItem.className = 'trial-tags-survey__tag-item';
            if (category.requiresIntensity) {
                tagItem.classList.add('trial-tags-survey__tag-item--with-intensity');
            }
            if (isSelected) {
                tagItem.classList.add('trial-tags-survey__tag-item--selected');
            }
            if (category.requiresIntensity && isSelected && !this.tagIntensities.has(tag.id)) {
                tagItem.classList.add('trial-tags-survey__tag-item--needs-intensity');
            }

            const tagButton = document.createElement('button');
            tagButton.className = 'trial-tags-survey__tag';
            tagButton.type = 'button';
            tagButton.dataset.tagId = tag.id;
            tagButton.dataset.categoryId = category.id;
            tagButton.textContent = tag.label;

            if (tag.description && tag.description !== tag.label) {
                tagButton.title = tag.description;
            }

            // Check if already selected
            if (isSelected) {
                tagButton.classList.add('selected');
            }

            tagButton.addEventListener('click', () => {
                this.toggleTag(tag.id, category.id);
            });

            tagItem.appendChild(tagButton);

            if (category.requiresIntensity && isSelected) {
                tagItem.appendChild(this.createIntensitySelector(tag.id, category));
            }

            tagsContainer.appendChild(tagItem);
        });
    }

    /**
     * Switch to a different category
     * @param {number} index - Category index to switch to
     */
    switchCategory(index) {
        if (index === this.currentCategoryIndex) return;
        if (index < 0 || index >= this.categories.length) return;

        this.currentCategoryIndex = index;

        // Update tab active states
        const tabs = this.container.querySelectorAll('.trial-tags-survey__tab');
        tabs.forEach((tab, i) => {
            tab.classList.toggle('active', i === index);
        });

        // Render new category
        this.renderCategory(index);
    }

    /**
     * Update tab badges with selection counts
     */
    updateTabBadges() {
        const tabs = this.container.querySelectorAll('.trial-tags-survey__tab');

        tabs.forEach((tab, index) => {
            const category = this.categories[index];
            if (!category) return;

            // Count selected tags in this category
            const count = category.tags.filter(tag => this.selectedTags.has(tag.id)).length;

            // Remove existing badge
            const existingBadge = tab.querySelector('.trial-tags-survey__tab-badge');
            if (existingBadge) {
                existingBadge.remove();
            }

            // Add badge if count > 0
            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'trial-tags-survey__tab-badge';
                badge.textContent = count;
                tab.appendChild(badge);
            }
        });
    }

    /**
     * Handle play/pause button click
     */
    handlePlayPause() {
        if (!this.pattern || !this.onPlayAudio) return;

        if (this.isPlaying) {
            if (this.onPauseAudio) {
                this.onPauseAudio();
            }
            this.isPlaying = false;
        } else {
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
            this.playButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="heroicon-pause">
                    <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" />
                </svg>
            `;
            this.playButton.setAttribute('aria-label', 'Pause audio');
            this.playButton.title = 'Pause';
        } else {
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
     * Create intensity selector for a selected tag.
     * @param {string} tagId - Tag ID
     * @param {Object} category - Tag category
     * @returns {HTMLElement}
     */
    createIntensitySelector(tagId, category) {
        const intensityContainer = document.createElement('div');
        intensityContainer.className = 'trial-tags-survey__tag-intensity';

        const label = document.createElement('div');
        label.className = 'trial-tags-survey__tag-intensity-label';
        label.textContent = 'Intensity';
        intensityContainer.appendChild(label);

        const options = document.createElement('div');
        options.className = 'trial-tags-survey__tag-intensity-options';
        intensityContainer.appendChild(options);

        const selectedIntensity = this.tagIntensities.get(tagId);
        category.intensityScale.forEach(intensity => {
            const intensityButton = document.createElement('button');
            intensityButton.className = 'trial-tags-survey__tag-intensity-btn';
            intensityButton.type = 'button';
            intensityButton.textContent = String(intensity);
            if (selectedIntensity === intensity) {
                intensityButton.classList.add('selected');
            }

            intensityButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.setTagIntensity(tagId, intensity);
            });

            options.appendChild(intensityButton);
        });

        return intensityContainer;
    }

    /**
     * Toggle tag selection
     * @param {string} tagId - Tag ID
     * @param {string} categoryId - Category ID
     * @param {HTMLElement} [button] - Optional tag button element for custom tags
     */
    toggleTag(tagId, categoryId, button = null) {
        if (this.selectedTags.has(tagId)) {
            this.selectedTags.delete(tagId);
            this.tagIntensities.delete(tagId);
            if (button) {
                button.classList.remove('selected');
            }
        } else {
            this.selectedTags.add(tagId);
            if (button) {
                button.classList.add('selected');
            }
        }

        const currentCategory = this.categories[this.currentCategoryIndex];
        if (currentCategory && currentCategory.id === categoryId) {
            this.renderCategory(this.currentCategoryIndex);
        }

        this.updateTabBadges();
        this.updateSubmitButton();
    }

    /**
     * Set intensity for a selected tag.
     * @param {string} tagId - Tag ID
     * @param {number} intensity - Selected intensity
     */
    setTagIntensity(tagId, intensity) {
        if (!this.selectedTags.has(tagId)) return;

        this.tagIntensities.set(tagId, intensity);

        const currentCategory = this.categories[this.currentCategoryIndex];
        if (currentCategory && currentCategory.tags.some(tag => tag.id === tagId)) {
            this.renderCategory(this.currentCategoryIndex);
        }

        this.updateSubmitButton();
    }

    /**
     * Add a custom tag
     * @param {string} tagText - Custom tag text
     */
    addCustomTag(tagText) {
        if (!tagText || tagText.trim() === '') return;

        const customTagId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.selectedTags.add(customTagId);
        this.customTags.add(customTagId);

        // Create tag button in custom tags display
        const tagButton = document.createElement('button');
        tagButton.className = 'trial-tags-survey__tag trial-tags-survey__tag--custom selected';
        tagButton.type = 'button';
        tagButton.dataset.tagId = customTagId;
        tagButton.dataset.customText = tagText;
        tagButton.textContent = tagText;

        const removeBtn = document.createElement('span');
        removeBtn.className = 'trial-tags-survey__tag-remove';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeCustomTag(customTagId, tagButton);
        });
        tagButton.appendChild(removeBtn);

        tagButton.addEventListener('click', () => {
            this.toggleTag(customTagId, 'custom', tagButton);
        });

        if (this.customTagsDisplayEl) {
            this.customTagsDisplayEl.appendChild(tagButton);
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
        this.tagIntensities.delete(tagId);
        if (button && button.parentElement) {
            button.remove();
        }
        this.updateSubmitButton();
    }

    /**
     * Update submit button enabled state
     */
    updateSubmitButton() {
        const overlayNextBtn = this.submitButtonRef || document.querySelector('.test-execution-overlay__next-btn');
        if (overlayNextBtn) {
            const hasSelectedTags = this.selectedTags.size > 0;
            const missingIntensityTagIds = this.getMissingIntensityTagIds();
            overlayNextBtn.disabled = !hasSelectedTags || missingIntensityTagIds.length > 0;

            if (!hasSelectedTags) {
                overlayNextBtn.title = 'Select at least one tag.';
            } else if (missingIntensityTagIds.length > 0) {
                overlayNextBtn.title = 'Choose intensity 1-4 for each selected action tag.';
            } else {
                overlayNextBtn.title = '';
            }
        }
    }

    /**
     * Get selected tags that still need an intensity value.
     * @returns {string[]} Selected tag IDs missing intensity
     */
    getMissingIntensityTagIds() {
        const missingTagIds = [];

        this.categories.forEach(category => {
            if (!category.requiresIntensity) return;

            category.tags.forEach(tag => {
                if (this.selectedTags.has(tag.id) && !this.tagIntensities.has(tag.id)) {
                    missingTagIds.push(tag.id);
                }
            });
        });

        return missingTagIds;
    }

    /**
     * Build the payload for a selected tag.
     * @param {string} tagId - Tag ID
     * @returns {Object}
     */
    buildSelectedTagPayload(tagId) {
        const customTagButton = this.container.querySelector(`[data-tag-id="${tagId}"].trial-tags-survey__tag--custom`);
        if (customTagButton) {
            return {
                id: tagId,
                label: customTagButton.dataset.customText || customTagButton.textContent.replace('×', '').trim(),
                category: 'custom',
                isCustom: true
            };
        }

        for (const category of this.categories) {
            const tag = category.tags.find(t => t.id === tagId);
            if (!tag) continue;

            const selectedTag = {
                id: tag.id,
                label: tag.label,
                category: category.id,
                isCustom: false
            };

            if (category.requiresIntensity) {
                selectedTag.intensity = this.tagIntensities.get(tagId) ?? null;
            }

            return selectedTag;
        }

        return { id: tagId, label: tagId, category: 'unknown', isCustom: false };
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
            console.warn('TrialTagsSurvey: Cannot submit without selecting at least one tag');
            return;
        }

        const missingIntensityTagIds = this.getMissingIntensityTagIds();
        if (missingIntensityTagIds.length > 0) {
            console.warn('TrialTagsSurvey: Cannot submit until all selected action tags have an intensity');
            return;
        }

        const selectedTagsArray = Array.from(this.selectedTags).map(tagId => this.buildSelectedTagPayload(tagId));

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
        this.tagIntensities.clear();
        this.currentCategoryIndex = 0;
        this.isPlaying = false;
        this.updatePlayButtonUI();

        // Re-render to reset all states
        this.render();
    }

    /**
     * Get selected tags
     * @returns {Array<Object>} Array of selected tag objects
     */
    getSelectedTags() {
        return Array.from(this.selectedTags).map(tagId => this.buildSelectedTagPayload(tagId));
    }
}
