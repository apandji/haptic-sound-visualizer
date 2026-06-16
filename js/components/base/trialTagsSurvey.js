/**
 * TrialTagsSurvey Component
 *
 * Structured 12-step response flow for each trial.
 * Uses the overlay Next/Finish control when available, with an internal fallback.
 */

class TrialTagsSurvey {
    constructor(options = {}) {
        this.containerId = options.containerId;
        this.container = options.container || (this.containerId ? document.getElementById(this.containerId) : null);
        this.onComplete = options.onComplete || null;
        this.pattern = options.pattern || null;
        this.onPlayAudio = options.onPlayAudio || null;
        this.onPauseAudio = options.onPauseAudio || null;
        this.knownCustomActions = Array.isArray(options.knownCustomActions) ? options.knownCustomActions : [];

        this.steps = [
            'scales',
            'actions',
            'emotion_mood',
            'emotion_anxiety',
            'emotion_focus',
            'emotion_body',
            'emotion_energy',
            'emotion_clarity',
            'emotion_social',
            'emotion_motivation',
            'vibes',
            'confidence'
        ];

        this.binaryPairs = typeof SURVEY_BINARY_PAIRS !== 'undefined' ? SURVEY_BINARY_PAIRS : [];
        this.vibePairs = typeof SURVEY_VIBE_PAIRS !== 'undefined' ? SURVEY_VIBE_PAIRS : [];
        this.emotionOptions = {
            mood: ['Distressed', 'Sad', 'Balanced', 'Happy', 'Ecstatic', 'Unsure'],
            anxiety: ['Meditative', 'Relaxed', 'Steady', 'Cautious', 'Anxious', 'Unsure'],
            focus: ['Scattered', 'Distracted', 'Present', 'Engaged', 'Absorbed', 'Unsure'],
            body: ['Tense', 'Tight', 'Neutral', 'Loose', 'Grounded', 'Unsure'],
            energy: ['Depleted', 'Tired', 'Neutral', 'Energized', 'Charged', 'Unsure'],
            clarity: ['Confused', 'Foggy', 'Clear', 'Sharp', 'Lucid', 'Unsure'],
            social: ['Withdrawn', 'Reserved', 'Open', 'Connected', 'Expansive', 'Unsure'],
            motivation: ['Resistant', 'Reluctant', 'Willing', 'Driven', 'Compelled', 'Unsure']
        };
        this.actionOptions = typeof SURVEY_OTHER_ACTION_OPTIONS !== 'undefined'
            ? SURVEY_OTHER_ACTION_OPTIONS
            : ['Lean', 'Slide', 'Turn', 'Twist', 'Run', 'Jump'];

        this.currentStepIndex = 0;
        this.response = this.createInitialResponse();
        this.sliderTouched = {
            urgency: false,
            intensity: false,
            confidence: false
        };
        this.isPlaying = false;
        this.playButton = null;
        this.submitButtonRef = null;
        this.finalSubmitLabel = 'Next';

        if (!this.container) {
            console.error('TrialTagsSurvey: Container not found');
            return;
        }

        this.init();
    }

    createInitialResponse() {
        return {
            urgency: 0.5,
            intensity: 0.5,
            binaryActions: {},
            action: {
                predefined: [],
                custom: [],
                customDraft: ''
            },
            emotion: {
                mood: null,
                anxiety: null,
                focus: null,
                body: null,
                energy: null,
                clarity: null,
                social: null,
                motivation: null
            },
            vibes: {},
            confidence: 0.5
        };
    }

    init() {
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'trial-tags-survey';

        const header = document.createElement('div');
        header.className = 'trial-tags-survey__header';
        this.container.appendChild(header);

        this.stepLabelEl = document.createElement('div');
        this.stepLabelEl.className = 'trial-tags-survey__step-label';
        header.appendChild(this.stepLabelEl);

        const headerRow = document.createElement('div');
        headerRow.className = 'trial-tags-survey__header-row';
        header.appendChild(headerRow);

        const instructions = document.createElement('div');
        instructions.className = 'trial-tags-survey__instructions';
        this.instructionsEl = instructions;
        headerRow.appendChild(instructions);

        if (this.pattern && this.onPlayAudio) {
            this.playButton = document.createElement('button');
            this.playButton.className = 'trial-tags-survey__play-btn';
            this.playButton.type = 'button';
            this.playButton.addEventListener('click', () => {
                this.handlePlayPause();
            });
            headerRow.appendChild(this.playButton);
        }

        this.feedbackEl = document.createElement('div');
        this.feedbackEl.className = 'trial-tags-survey__feedback';
        this.feedbackEl.setAttribute('aria-live', 'polite');

        this.contentEl = document.createElement('div');
        this.contentEl.className = 'trial-tags-survey__content';
        this.container.appendChild(this.contentEl);

        this.footerEl = document.createElement('div');
        this.footerEl.className = 'trial-tags-survey__footer';
        this.container.appendChild(this.footerEl);

        this.footerEl.appendChild(this.feedbackEl);

        this.footerNavEl = document.createElement('div');
        this.footerNavEl.className = 'trial-tags-survey__footer-nav';
        this.footerEl.appendChild(this.footerNavEl);

        this.backButton = document.createElement('button');
        this.backButton.className = 'trial-tags-survey__nav-btn trial-tags-survey__nav-btn--secondary';
        this.backButton.type = 'button';
        this.backButton.textContent = 'Back';
        this.backButton.addEventListener('click', () => {
            this.goBack();
        });
        this.footerNavEl.appendChild(this.backButton);

        this.internalNextButton = document.createElement('button');
        this.internalNextButton.className = 'trial-tags-survey__nav-btn trial-tags-survey__nav-btn--primary';
        this.internalNextButton.type = 'button';
        this.internalNextButton.addEventListener('click', () => {
            this.submit();
        });
        this.footerNavEl.appendChild(this.internalNextButton);

        this.updatePlayButtonUI();
        this.renderCurrentStep();
    }

    renderCurrentStep() {
        if (!this.contentEl) return;

        this.contentEl.innerHTML = '';
        this.stepLabelEl.textContent = `Step ${this.currentStepIndex + 1} of ${this.steps.length}`;

        const stepKey = this.steps[this.currentStepIndex];
        if (this.instructionsEl) {
            this.instructionsEl.textContent = this.getStepInstructions(stepKey);
        }

        if (stepKey === 'scales') {
            this.renderScaleStep();
        } else if (stepKey === 'actions') {
            this.renderActionsStep();
        } else if (stepKey === 'emotion_mood') {
            this.renderEmotionStep('mood', 'Mood');
        } else if (stepKey === 'emotion_anxiety') {
            this.renderEmotionStep('anxiety', 'Anxiety');
        } else if (stepKey === 'emotion_focus') {
            this.renderEmotionStep('focus', 'Focus');
        } else if (stepKey === 'emotion_body') {
            this.renderEmotionStep('body', 'Body');
        } else if (stepKey === 'emotion_energy') {
            this.renderEmotionStep('energy', 'Energy');
        } else if (stepKey === 'emotion_clarity') {
            this.renderEmotionStep('clarity', 'Clarity');
        } else if (stepKey === 'emotion_social') {
            this.renderEmotionStep('social', 'Social');
        } else if (stepKey === 'emotion_motivation') {
            this.renderEmotionStep('motivation', 'Motivation');
        } else if (stepKey === 'vibes') {
            this.renderVibesStep();
        } else if (stepKey === 'confidence') {
            this.renderConfidenceStep();
        }

        this.updateNavigationState();
    }

    createSection(title, subtitle) {
        const section = document.createElement('section');
        section.className = 'trial-tags-survey__section';

        const titleEl = document.createElement('h2');
        titleEl.className = 'trial-tags-survey__section-title';
        titleEl.textContent = title;
        section.appendChild(titleEl);

        if (subtitle) {
            const subtitleEl = document.createElement('p');
            subtitleEl.className = 'trial-tags-survey__section-subtitle';
            subtitleEl.textContent = subtitle;
            section.appendChild(subtitleEl);
        }

        return section;
    }

    renderScaleStep() {
        const urgencySection = this.createSection('Urgency', 'How urgent does this pattern feel?');
        urgencySection.appendChild(this.createSliderField('urgency'));
        this.contentEl.appendChild(urgencySection);

        const intensitySection = this.createSection('Intensity', 'How intense does this pattern feel?');
        intensitySection.appendChild(this.createSliderField('intensity'));
        this.contentEl.appendChild(intensitySection);
    }

    renderActionsStep() {
        const section = this.createSection(
            'Actions',
            'What action does this pattern suggest you do?'
        );

        const hint = document.createElement('p');
        hint.className = 'trial-tags-survey__hint trial-tags-survey__hint--prompt';
        hint.textContent = 'If the pattern does not suggest either option, feel free to leave blank.';
        section.appendChild(hint);

        section.appendChild(this.createEitherOrBlock());
        section.appendChild(this.createOtherActionsBlock());

        this.contentEl.appendChild(section);
    }

    createEitherOrBlock() {
        const block = document.createElement('div');
        block.className = 'trial-tags-survey__block';

        const title = document.createElement('h3');
        title.className = 'trial-tags-survey__block-title';
        title.textContent = 'Either/or';
        block.appendChild(title);

        const blockHint = document.createElement('p');
        blockHint.className = 'trial-tags-survey__block-hint';
        blockHint.textContent = 'Pick one side if the pattern suggests it.';
        block.appendChild(blockHint);

        const grid = document.createElement('div');
        grid.className = 'trial-tags-survey__segmented-grid';
        this.binaryPairs.forEach((pair) => {
            grid.appendChild(this.createSegmentedPair(
                pair.options,
                this.response.binaryActions[pair.id] || null,
                (value) => {
                    this.setBinaryActionSelection(pair.id, value);
                    this.renderCurrentStep();
                }
            ));
        });
        block.appendChild(grid);

        return block;
    }

    createOtherActionsBlock() {
        const block = document.createElement('div');
        block.className = 'trial-tags-survey__block trial-tags-survey__block--other';

        const title = document.createElement('h3');
        title.className = 'trial-tags-survey__block-title';
        title.textContent = 'Other actions';
        block.appendChild(title);

        const blockHint = document.createElement('p');
        blockHint.className = 'trial-tags-survey__block-hint';
        blockHint.textContent = 'Select any that apply, or add your own.';
        block.appendChild(blockHint);

        const chipGrid = document.createElement('div');
        chipGrid.className = 'trial-tags-survey__chip-grid';

        this.actionOptions.forEach((option) => {
            chipGrid.appendChild(this.createOptionButton(
                option,
                this.response.action.predefined.includes(option) ? option : null,
                (value) => {
                    this.togglePredefinedAction(value);
                    this.renderCurrentStep();
                },
                true
            ));
        });

        this.getMergedRecentActions().forEach((option) => {
            const button = document.createElement('button');
            button.className = 'trial-tags-survey__option-btn trial-tags-survey__option-btn--known';
            button.type = 'button';
            button.textContent = option;
            if (this.isCustomActionSelected(option)) {
                button.classList.add('selected');
            }
            button.addEventListener('click', () => {
                this.toggleKnownCustomAction(option);
                this.renderCurrentStep();
            });
            chipGrid.appendChild(button);
        });

        const adHocCustomValues = this.getCustomActionValues().filter((value) => {
            const key = value.toLowerCase();
            const inPredefined = this.actionOptions.some((option) => option.toLowerCase() === key);
            const inRecent = this.getMergedRecentActions().some((option) => option.toLowerCase() === key);
            return !inPredefined && !inRecent;
        });

        adHocCustomValues.forEach((value) => {
            const customTag = document.createElement('div');
            customTag.className = 'trial-tags-survey__option-btn trial-tags-survey__option-btn--custom selected';

            const label = document.createElement('span');
            label.className = 'trial-tags-survey__option-btn-label';
            label.textContent = value;
            customTag.appendChild(label);

            const removeButton = document.createElement('button');
            removeButton.className = 'trial-tags-survey__option-btn-remove';
            removeButton.type = 'button';
            removeButton.textContent = '×';
            removeButton.setAttribute('aria-label', `Remove custom action ${value}`);
            removeButton.addEventListener('click', () => {
                this.removeCustomAction(value);
                this.renderCurrentStep();
            });
            customTag.appendChild(removeButton);
            chipGrid.appendChild(customTag);
        });

        block.appendChild(chipGrid);

        const inlineAdd = document.createElement('div');
        inlineAdd.className = 'trial-tags-survey__inline-add';

        const customInput = document.createElement('input');
        customInput.className = 'trial-tags-survey__text-input';
        customInput.type = 'text';
        customInput.maxLength = 120;
        customInput.placeholder = 'Add your own action…';
        customInput.value = this.response.action.customDraft || '';

        const addButton = document.createElement('button');
        addButton.className = 'trial-tags-survey__add-btn';
        addButton.type = 'button';
        addButton.textContent = 'Add';

        const syncAddButtonState = () => {
            addButton.disabled = !this.canAddCustomActionValue(this.response.action.customDraft);
        };

        customInput.addEventListener('input', (event) => {
            this.response.action.customDraft = event.target.value;
            syncAddButtonState();
        });
        customInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (this.addCustomAction()) {
                this.renderCurrentStep();
            }
        });
        inlineAdd.appendChild(customInput);

        addButton.addEventListener('click', () => {
            if (this.addCustomAction()) {
                this.renderCurrentStep();
            }
        });
        inlineAdd.appendChild(addButton);
        syncAddButtonState();

        block.appendChild(inlineAdd);
        return block;
    }

    getMergedRecentActions() {
        const seen = new Set(this.actionOptions.map((option) => option.toLowerCase()));
        return this.knownCustomActions.filter((option) => {
            const key = String(option || '').trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    getStepInstructions(stepKey) {
        if (stepKey === 'actions' || stepKey === 'vibes') {
            return 'Replay the pattern if needed. Everything on this step is optional.';
        }
        if (stepKey === 'scales') {
            return 'Replay the pattern if needed. Set both sliders before continuing.';
        }
        if (stepKey === 'confidence') {
            return 'Adjust the slider before finishing this survey.';
        }
        if (stepKey.startsWith('emotion_')) {
            return 'Replay the pattern if needed. Choose one response before continuing.';
        }
        return 'Replay the pattern if needed.';
    }

    setBinaryActionSelection(pairId, value) {
        const current = this.response.binaryActions[pairId] || null;
        if (current === value) {
            delete this.response.binaryActions[pairId];
            return;
        }
        this.response.binaryActions[pairId] = value;
    }

    setVibeSelection(pairId, value) {
        const current = this.response.vibes[pairId] || null;
        if (current === value) {
            delete this.response.vibes[pairId];
            return;
        }
        this.response.vibes[pairId] = value;
    }

    renderEmotionStep(facet, subtitle) {
        const section = this.createSection('Emotion', subtitle);
        section.appendChild(this.createEmotionScaleButtons(
            this.emotionOptions[facet],
            this.response.emotion[facet],
            (value) => {
                this.response.emotion[facet] = value;
                this.renderCurrentStep();
            }
        ));
        this.contentEl.appendChild(section);
    }

    renderVibesStep() {
        const section = this.createSection(
            'Vibes',
            'If this pattern had a vibe to it, what would it be?'
        );

        const hint = document.createElement('p');
        hint.className = 'trial-tags-survey__hint trial-tags-survey__hint--prompt';
        hint.textContent = 'If the pattern does not suggest either option, feel free to leave blank.';
        section.appendChild(hint);

        const grid = document.createElement('div');
        grid.className = 'trial-tags-survey__segmented-grid';
        this.vibePairs.forEach((pair) => {
            grid.appendChild(this.createSegmentedPair(
                pair.options,
                this.response.vibes[pair.id] || null,
                (value) => {
                    this.setVibeSelection(pair.id, value);
                    this.renderCurrentStep();
                }
            ));
        });
        section.appendChild(grid);

        this.contentEl.appendChild(section);
    }

    renderConfidenceStep() {
        const section = this.createSection('Confidence', 'For this pattern, how confident are you in your responses?');
        section.appendChild(this.createSliderField('confidence'));
        this.contentEl.appendChild(section);
    }

    // Shared-understanding context per slider, so every participant grades
    // against the same mental model instead of a private 0-1 scale.
    static SLIDER_CONTEXT = {
        urgency: {
            help: 'How quickly does it demand a response? Imagine feeling it while driving: could you safely ignore it, or would you need to act right away?',
            low: 'Could ignore it',
            high: 'Act right now',
            bands: ['Ignorable', 'Mild nudge', 'Worth attention', 'Urgent', 'Act now']
        },
        intensity: {
            help: 'The physical strength of the vibration on your skin — not how important it felt.',
            low: 'Barely felt',
            high: 'Overwhelming',
            bands: ['Barely there', 'Gentle', 'Moderate', 'Strong', 'Overwhelming']
        },
        confidence: {
            help: 'How sure are you about the answers you just gave for this pattern?',
            low: 'Mostly guessing',
            high: 'Completely sure',
            bands: ['Just guessing', 'Unsure', 'Somewhat sure', 'Confident', 'Certain'],
            percent: true
        }
    };

    // 0-1 value -> qualitative band index (0-4)
    static sliderBandIndex(value) {
        return Math.max(0, Math.min(4, Math.floor(Number(value) * 5)));
    }

    createSliderField(fieldName) {
        const wrapper = document.createElement('div');
        wrapper.className = `trial-tags-survey__slider-field trial-tags-survey__slider-field--${fieldName}`;
        const context = TrialTagsSurvey.SLIDER_CONTEXT[fieldName] || null;

        if (context?.help) {
            const help = document.createElement('p');
            help.className = 'trial-tags-survey__slider-help';
            help.textContent = context.help;
            wrapper.appendChild(help);
        }

        const row = document.createElement('div');
        row.className = 'trial-tags-survey__slider-row';
        wrapper.appendChild(row);

        const label = document.createElement('span');
        label.className = 'trial-tags-survey__field-label';
        label.textContent = this.formatSliderLabel(fieldName);
        row.appendChild(label);

        const valueEl = document.createElement('span');
        valueEl.className = 'trial-tags-survey__slider-value';
        const wordEl = document.createElement('span');
        wordEl.className = 'trial-tags-survey__value-word';
        const numEl = document.createElement('span');
        numEl.className = 'trial-tags-survey__value-num';
        valueEl.appendChild(wordEl);
        valueEl.appendChild(numEl);
        row.appendChild(valueEl);

        // Live qualitative readout: the word is the primary feedback so
        // participants calibrate against shared meaning, not a private
        // sense of what 0.59 is. The number stays as a muted secondary cue.
        const updateValueDisplay = (value) => {
            if (context?.bands) {
                const band = TrialTagsSurvey.sliderBandIndex(value);
                wordEl.textContent = context.bands[band];
                wordEl.dataset.band = String(band);
                numEl.textContent = context.percent
                    ? `${Math.round(value * 100)}%`
                    : this.formatFloat(value);
            } else {
                wordEl.textContent = '';
                numEl.textContent = this.formatFloat(value);
            }
        };
        updateValueDisplay(this.response[fieldName]);

        const input = document.createElement('input');
        input.className = 'trial-tags-survey__slider';
        input.type = 'range';
        input.min = '0';
        input.max = '1';
        input.step = '0.01';
        input.value = String(this.response[fieldName]);
        input.addEventListener('input', (event) => {
            const nextValue = Number(event.target.value);
            this.response[fieldName] = nextValue;
            this.sliderTouched[fieldName] = true;
            updateValueDisplay(nextValue);
            this.updateNavigationState();
        });
        wrapper.appendChild(input);

        const scale = document.createElement('div');
        scale.className = 'trial-tags-survey__slider-scale';
        scale.innerHTML = context
            ? `
                <span class="trial-tags-survey__anchor">
                    <span class="trial-tags-survey__anchor-num">0</span>${this._escapeHtml(context.low)}
                </span>
                <span class="trial-tags-survey__anchor trial-tags-survey__anchor--high">
                    ${this._escapeHtml(context.high)}<span class="trial-tags-survey__anchor-num">1</span>
                </span>
            `
            : '<span>0.00</span><span>1.00</span>';
        wrapper.appendChild(scale);

        return wrapper;
    }

    _escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    createSegmentedPair(options, selectedValue, onSelect) {
        const row = document.createElement('div');
        row.className = 'trial-tags-survey__segmented';
        row.setAttribute('role', 'group');

        options.forEach((option) => {
            const button = document.createElement('button');
            button.className = 'trial-tags-survey__segmented-btn';
            button.type = 'button';
            button.textContent = option;
            if (selectedValue === option) {
                button.classList.add('selected');
            }
            button.addEventListener('click', () => {
                if (selectedValue === option) {
                    onSelect(option);
                    return;
                }
                onSelect(option);
            });
            row.appendChild(button);
        });

        return row;
    }

    createAxisGroup(label, options, selectedValue, onSelect) {
        const group = document.createElement('div');
        group.className = 'trial-tags-survey__option-group';

        const labelEl = document.createElement('div');
        labelEl.className = 'trial-tags-survey__group-label';
        labelEl.textContent = label;
        group.appendChild(labelEl);

        group.appendChild(this.createSingleSelectButtons(options, selectedValue, onSelect, true));
        return group;
    }

    createSingleSelectButtons(options, selectedValue, onSelect, allowToggle = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'trial-tags-survey__button-grid';

        options.forEach((option) => {
            wrapper.appendChild(
                this.createOptionButton(option, selectedValue, onSelect, allowToggle)
            );
        });

        return wrapper;
    }

    /**
     * Emotion facets: five scale choices + trailing "Unsure" on one row, with a divider before Unsure.
     */
    createEmotionScaleButtons(options, selectedValue, onSelect) {
        const wrapper = document.createElement('div');
        wrapper.className =
            'trial-tags-survey__button-grid trial-tags-survey__button-grid--emotion-scale';

        const last = options[options.length - 1];
        const splitUnsure = last === 'Unsure' && options.length >= 2;
        const scaleOptions = splitUnsure ? options.slice(0, -1) : [...options];

        scaleOptions.forEach((option) => {
            wrapper.appendChild(this.createOptionButton(option, selectedValue, onSelect, false));
        });

        if (splitUnsure) {
            const divider = document.createElement('span');
            divider.className = 'trial-tags-survey__emotion-divider';
            divider.setAttribute('role', 'presentation');
            divider.setAttribute('aria-hidden', 'true');
            wrapper.appendChild(divider);
            wrapper.appendChild(this.createOptionButton(last, selectedValue, onSelect, false));
        }

        return wrapper;
    }

    createOptionButton(option, selectedValue, onSelect, allowToggle) {
        const button = document.createElement('button');
        button.className = 'trial-tags-survey__option-btn';
        button.type = 'button';
        button.textContent = option;
        if (selectedValue === option) {
            button.classList.add('selected');
        }
        button.addEventListener('click', () => {
            if (allowToggle && selectedValue === option) {
                onSelect(option);
                return;
            }
            onSelect(option);
        });
        return button;
    }

    createMultiSelectButtons(options, selectedValues, onToggle) {
        const wrapper = document.createElement('div');
        wrapper.className = 'trial-tags-survey__button-grid';

        options.forEach((option) => {
            const button = document.createElement('button');
            button.className = 'trial-tags-survey__option-btn';
            button.type = 'button';
            button.textContent = option;
            if (selectedValues.includes(option)) {
                button.classList.add('selected');
            }
            button.addEventListener('click', () => {
                onToggle(option);
            });
            wrapper.appendChild(button);
        });

        return wrapper;
    }

    createKnownCustomActionButtons() {
        const wrapper = document.createElement('div');
        wrapper.className = 'trial-tags-survey__button-grid';

        this.knownCustomActions.forEach((option) => {
            const button = document.createElement('button');
            button.className = 'trial-tags-survey__option-btn trial-tags-survey__option-btn--known';
            button.type = 'button';
            button.textContent = option;
            if (this.isCustomActionSelected(option)) {
                button.classList.add('selected');
            }
            button.addEventListener('click', () => {
                this.toggleKnownCustomAction(option);
                this.renderCurrentStep();
            });
            wrapper.appendChild(button);
        });

        return wrapper;
    }

    createActionButtons(options, selectedValues, customValues, onToggle, onRemoveCustom) {
        const wrapper = this.createMultiSelectButtons(options, selectedValues, onToggle);

        customValues.forEach((value) => {
            const customTag = document.createElement('div');
            customTag.className = 'trial-tags-survey__option-btn trial-tags-survey__option-btn--custom selected';

            const label = document.createElement('span');
            label.className = 'trial-tags-survey__option-btn-label';
            label.textContent = value;
            customTag.appendChild(label);

            const removeButton = document.createElement('button');
            removeButton.className = 'trial-tags-survey__option-btn-remove';
            removeButton.type = 'button';
            removeButton.textContent = 'x';
            removeButton.setAttribute('aria-label', `Remove custom action ${value}`);
            removeButton.addEventListener('click', () => {
                onRemoveCustom(value);
            });
            customTag.appendChild(removeButton);

            wrapper.appendChild(customTag);
        });

        return wrapper;
    }

    togglePredefinedAction(value) {
        if (this.response.action.predefined.includes(value)) {
            this.response.action.predefined = this.response.action.predefined.filter((item) => item !== value);
            return;
        }
        this.response.action.predefined = [...this.response.action.predefined, value];
    }

    addCustomAction() {
        const draftKey = this.normalizeCustomActionValue(this.response.action.customDraft).toLowerCase();
        const knownMatch = this.knownCustomActions.find(
            (option) => option.toLowerCase() === draftKey
        );
        let nextValue = knownMatch || this.normalizeCustomActionValue(this.response.action.customDraft);
        if (!this.canAddCustomActionValue(nextValue)) {
            return false;
        }

        this.response.action.custom = [...this.getCustomActionValues(), nextValue];
        this.response.action.customDraft = '';
        this.updateNavigationState();
        return true;
    }

    removeCustomAction(valueToRemove) {
        this.response.action.custom = this.getCustomActionValues().filter((value) => value !== valueToRemove);
        this.updateNavigationState();
    }

    isCustomActionSelected(value) {
        const key = String(value || '').trim().toLowerCase();
        return this.getCustomActionValues().some((option) => option.toLowerCase() === key);
    }

    toggleKnownCustomAction(value) {
        const key = String(value || '').trim().toLowerCase();
        if (this.isCustomActionSelected(value)) {
            this.response.action.custom = this.getCustomActionValues().filter(
                (option) => option.toLowerCase() !== key
            );
            return;
        }
        this.response.action.custom = [...this.getCustomActionValues(), value];
    }

    normalizeCustomActionValue(value) {
        const collapsed = String(value || '').trim().replace(/\s+/g, ' ');
        if (!collapsed) {
            return '';
        }
        return collapsed
            .split(' ')
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    canAddCustomActionValue(value) {
        const normalizedValue = this.normalizeCustomActionValue(value);
        if (!normalizedValue) {
            return false;
        }

        const normalizedKey = normalizedValue.toLowerCase();
        const existingPredefined = this.actionOptions.some((option) => option.toLowerCase() === normalizedKey);
        const existingCustom = this.getCustomActionValues().some((option) => option.toLowerCase() === normalizedKey);

        return !existingPredefined && !existingCustom;
    }

    getCustomActionValues(actionPayload = this.response.action) {
        const rawCustom = actionPayload?.custom;
        const values = Array.isArray(rawCustom)
            ? rawCustom
            : [rawCustom];

        const normalizedValues = [];
        const seenValues = new Set();

        values.forEach((value) => {
            const normalized = this.normalizeCustomActionValue(value);
            const dedupeKey = normalized.toLowerCase();
            if (!normalized || seenValues.has(dedupeKey)) {
                return;
            }
            seenValues.add(dedupeKey);
            normalizedValues.push(normalized);
        });

        return normalizedValues;
    }

    formatSliderLabel(fieldName) {
        if (fieldName === 'urgency') return 'Urgency value';
        if (fieldName === 'intensity') return 'Intensity value';
        if (fieldName === 'confidence') return 'Confidence value';
        return 'Value';
    }

    formatFloat(value) {
        return Number(value).toFixed(2);
    }

    getValidationMessage() {
        const stepKey = this.steps[this.currentStepIndex];

        if (stepKey === 'scales') {
            if (!this.sliderTouched.urgency || !this.sliderTouched.intensity) {
                return 'Set both Urgency and Intensity before continuing.';
            }
            return '';
        }

        if (stepKey === 'actions') {
            return '';
        }

        if (stepKey === 'vibes') {
            return '';
        }

        if (stepKey.startsWith('emotion_')) {
            const facet = stepKey.replace('emotion_', '');
            if (!this.response.emotion[facet]) {
                return `Choose one ${facet} response before continuing.`;
            }
            return '';
        }

        if (stepKey === 'confidence') {
            if (!this.sliderTouched.confidence) {
                return 'Set Confidence before finishing this survey.';
            }
            return '';
        }

        return '';
    }

    updateNavigationState() {
        const validationMessage = this.getValidationMessage();
        const isValid = validationMessage === '';
        const onLastStep = this.currentStepIndex === this.steps.length - 1;
        const finalLabel = this.submitButtonRef ? this.finalSubmitLabel : 'Submit';

        if (this.feedbackEl) {
            this.feedbackEl.textContent = validationMessage || (onLastStep ? 'Ready to finish this survey.' : 'Ready to continue.');
        }

        if (this.backButton) {
            this.backButton.disabled = this.currentStepIndex === 0;
        }

        if (this.internalNextButton) {
            this.internalNextButton.disabled = !isValid;
            this.internalNextButton.textContent = onLastStep ? finalLabel : 'Next';
            this.internalNextButton.style.display = this.submitButtonRef ? 'none' : 'inline-flex';
        }

        if (this.submitButtonRef) {
            this.submitButtonRef.disabled = !isValid;
            this.submitButtonRef.title = validationMessage;
            this.submitButtonRef.textContent = onLastStep ? finalLabel : 'Next';
        }
    }

    commitPendingCustomActionDraft() {
        const draft = this.normalizeCustomActionValue(this.response.action.customDraft);
        if (!draft || !this.canAddCustomActionValue(draft)) {
            return;
        }
        this.response.action.custom = [...this.getCustomActionValues(), draft];
        this.response.action.customDraft = '';
    }

    buildSurveyResponse() {
        this.commitPendingCustomActionDraft();
        return {
            urgency: this.response.urgency,
            intensity: this.response.intensity,
            binaryActions: { ...this.response.binaryActions },
            action: {
                predefined: [...this.response.action.predefined],
                custom: [...this.getCustomActionValues()]
            },
            emotion: {
                mood: this.response.emotion.mood,
                anxiety: this.response.emotion.anxiety,
                focus: this.response.emotion.focus,
                body: this.response.emotion.body,
                energy: this.response.emotion.energy,
                clarity: this.response.emotion.clarity,
                social: this.response.emotion.social,
                motivation: this.response.emotion.motivation
            },
            vibes: { ...this.response.vibes },
            confidence: this.response.confidence
        };
    }

    buildSelectedTags(surveyResponse) {
        const tags = [];
        const binaryActions = surveyResponse.binaryActions || {};
        const action = surveyResponse.action || {};
        const emotion = surveyResponse.emotion || {};
        const vibes = surveyResponse.vibes || {};

        const pushTag = (id, label, category, isCustom = false) => {
            tags.push({ id, label, category, isCustom });
        };

        Object.entries(binaryActions).forEach(([pairId, value]) => {
            if (!value) return;
            pushTag(`binary:${pairId}:${this.slugify(value)}`, `Binary: ${value}`, 'binary_action');
        });

        (action.predefined || []).forEach((value) => {
            pushTag(`action:${this.slugify(value)}`, `Action: ${value}`, 'action');
        });

        this.getCustomActionValues(action).forEach((customValue) => {
            pushTag(`action:custom:${this.slugify(customValue)}`, `Action: ${customValue}`, 'action', true);
        });

        Object.entries(emotion).forEach(([facet, value]) => {
            if (!value) return;
            pushTag(`emotion:${facet}:${this.slugify(value)}`, `${this.toTitleCase(facet)}: ${value}`, `emotion:${facet}`);
        });

        Object.entries(vibes).forEach(([pairId, value]) => {
            if (!value) return;
            pushTag(`vibe:${pairId}:${this.slugify(value)}`, `Vibe: ${value}`, 'vibe');
        });

        return tags;
    }

    buildSubmissionPayload() {
        const surveyResponse = this.buildSurveyResponse();
        return {
            surveyResponse,
            selectedTags: this.buildSelectedTags(surveyResponse)
        };
    }

    slugify(value) {
        return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
    }

    toTitleCase(value) {
        return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    }

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

    setPlayingState(isPlaying) {
        this.isPlaying = isPlaying;
        this.updatePlayButtonUI();
    }

    updatePlayButtonUI() {
        if (!this.playButton) return;

        this.playButton.textContent = this.isPlaying ? 'Pause Audio' : 'Play Audio';
        this.playButton.setAttribute('aria-label', this.isPlaying ? 'Pause audio' : 'Play audio');
    }

    goBack() {
        if (this.currentStepIndex === 0) return;
        this.currentStepIndex -= 1;
        this.renderCurrentStep();
    }

    submit() {
        const validationMessage = this.getValidationMessage();
        if (validationMessage) {
            console.warn(`TrialTagsSurvey: ${validationMessage}`);
            return;
        }

        if (this.currentStepIndex < this.steps.length - 1) {
            if (this.steps[this.currentStepIndex] === 'actions') {
                this.commitPendingCustomActionDraft();
            }
            this.currentStepIndex += 1;
            this.renderCurrentStep();
            return;
        }

        if (this.onComplete) {
            this.onComplete(this.buildSubmissionPayload());
        }
    }

    setOverlayNextButton(button) {
        this.submitButtonRef = button;
        this.finalSubmitLabel = (button?.textContent && button.textContent.trim()) || 'Next';
        if (button && this.footerNavEl) {
            button.classList.add('trial-tags-survey__nav-btn', 'trial-tags-survey__nav-btn--primary');
            this.footerNavEl.appendChild(button);
        }
        this.updateNavigationState();
    }

    reset() {
        this.currentStepIndex = 0;
        this.response = this.createInitialResponse();
        this.sliderTouched = {
            urgency: false,
            intensity: false,
            confidence: false
        };
        this.isPlaying = false;
        this.updatePlayButtonUI();
        this.renderCurrentStep();
    }

    getSelectedTags() {
        return this.buildSelectedTags(this.buildSurveyResponse());
    }

    getSurveyResponse() {
        return this.buildSurveyResponse();
    }
}
