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

        this.steps = [
            'scales',
            'direction_action',
            'emotion_mood',
            'emotion_anxiety',
            'emotion_focus',
            'emotion_body',
            'emotion_energy',
            'emotion_clarity',
            'emotion_social',
            'emotion_motivation',
            'texture',
            'confidence'
        ];

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
            direction: {
                leftRight: null,
                upDown: null,
                forwardBackward: null
            },
            action: {
                predefined: [],
                custom: ''
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
            texture: {
                temperature: null,
                hardness: null,
                surface: null
            },
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
        instructions.textContent = 'Replay the pattern if needed. Required sections must be completed before you can continue.';
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
        header.appendChild(this.feedbackEl);

        this.contentEl = document.createElement('div');
        this.contentEl.className = 'trial-tags-survey__content';
        this.container.appendChild(this.contentEl);

        this.footerEl = document.createElement('div');
        this.footerEl.className = 'trial-tags-survey__footer';
        this.container.appendChild(this.footerEl);

        this.backButton = document.createElement('button');
        this.backButton.className = 'trial-tags-survey__nav-btn trial-tags-survey__nav-btn--secondary';
        this.backButton.type = 'button';
        this.backButton.textContent = 'Back';
        this.backButton.addEventListener('click', () => {
            this.goBack();
        });
        this.footerEl.appendChild(this.backButton);

        this.internalNextButton = document.createElement('button');
        this.internalNextButton.className = 'trial-tags-survey__nav-btn trial-tags-survey__nav-btn--primary';
        this.internalNextButton.type = 'button';
        this.internalNextButton.addEventListener('click', () => {
            this.submit();
        });
        this.footerEl.appendChild(this.internalNextButton);

        this.updatePlayButtonUI();
        this.renderCurrentStep();
    }

    renderCurrentStep() {
        if (!this.contentEl) return;

        this.contentEl.innerHTML = '';
        this.stepLabelEl.textContent = `Step ${this.currentStepIndex + 1} of ${this.steps.length}`;

        const stepKey = this.steps[this.currentStepIndex];

        if (stepKey === 'scales') {
            this.renderScaleStep();
        } else if (stepKey === 'direction_action') {
            this.renderDirectionActionStep();
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
        } else if (stepKey === 'texture') {
            this.renderTextureStep();
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

    renderDirectionActionStep() {
        const directionSection = this.createSection('Direction', 'Does this pattern make you want to go in a certain direction?');
        directionSection.appendChild(this.createAxisGroup(
            'Left or Right',
            ['Left', 'Right'],
            this.response.direction.leftRight,
            (value) => {
                this.response.direction.leftRight = this.response.direction.leftRight === value ? null : value;
                this.renderCurrentStep();
            }
        ));
        directionSection.appendChild(this.createAxisGroup(
            'Up or Down',
            ['Up', 'Down'],
            this.response.direction.upDown,
            (value) => {
                this.response.direction.upDown = this.response.direction.upDown === value ? null : value;
                this.renderCurrentStep();
            }
        ));
        directionSection.appendChild(this.createAxisGroup(
            'Forward or Backward',
            ['Forward', 'Backward'],
            this.response.direction.forwardBackward,
            (value) => {
                this.response.direction.forwardBackward = this.response.direction.forwardBackward === value ? null : value;
                this.renderCurrentStep();
            }
        ));
        const directionHint = document.createElement('div');
        directionHint.className = 'trial-tags-survey__hint';
        directionHint.textContent = 'Direction is optional. Leave all groups blank if none apply.';
        directionSection.appendChild(directionHint);
        this.contentEl.appendChild(directionSection);

        const actionSection = this.createSection('Action', 'What action does this pattern suggest?');
        actionSection.appendChild(this.createMultiSelectButtons(
            ['Lean', 'Slide', 'Turn', 'Twist', 'Run', 'Jump'],
            this.response.action.predefined,
            (value) => {
                this.togglePredefinedAction(value);
                this.renderCurrentStep();
            }
        ));

        const customLabel = document.createElement('label');
        customLabel.className = 'trial-tags-survey__field-label';
        customLabel.textContent = 'Custom action';
        actionSection.appendChild(customLabel);

        const customInput = document.createElement('input');
        customInput.className = 'trial-tags-survey__text-input';
        customInput.type = 'text';
        customInput.maxLength = 120;
        customInput.placeholder = 'Type your own action';
        customInput.value = this.response.action.custom;
        customInput.addEventListener('input', (event) => {
            this.response.action.custom = event.target.value;
            this.updateNavigationState();
        });
        actionSection.appendChild(customInput);

        const actionHint = document.createElement('div');
        actionHint.className = 'trial-tags-survey__hint';
        actionHint.textContent = 'At least one action response is required.';
        actionSection.appendChild(actionHint);
        this.contentEl.appendChild(actionSection);
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

    renderTextureStep() {
        const section = this.createSection('Texture', 'If this pattern had a textural quality, what would it be?');
        section.appendChild(this.createAxisGroup(
            'Hot or Cold',
            ['Hot', 'Cold'],
            this.response.texture.temperature,
            (value) => {
                this.response.texture.temperature = this.response.texture.temperature === value ? null : value;
                this.renderCurrentStep();
            }
        ));
        section.appendChild(this.createAxisGroup(
            'Hard or Soft',
            ['Hard', 'Soft'],
            this.response.texture.hardness,
            (value) => {
                this.response.texture.hardness = this.response.texture.hardness === value ? null : value;
                this.renderCurrentStep();
            }
        ));
        section.appendChild(this.createAxisGroup(
            'Smooth or Rough',
            ['Smooth', 'Rough'],
            this.response.texture.surface,
            (value) => {
                this.response.texture.surface = this.response.texture.surface === value ? null : value;
                this.renderCurrentStep();
            }
        ));
        const hint = document.createElement('div');
        hint.className = 'trial-tags-survey__hint';
        hint.textContent = 'Texture is optional.';
        section.appendChild(hint);
        this.contentEl.appendChild(section);
    }

    renderConfidenceStep() {
        const section = this.createSection('Confidence', 'For this pattern, how confident are you in your responses?');
        section.appendChild(this.createSliderField('confidence'));
        this.contentEl.appendChild(section);
    }

    createSliderField(fieldName) {
        const wrapper = document.createElement('div');
        wrapper.className = 'trial-tags-survey__slider-field';

        const row = document.createElement('div');
        row.className = 'trial-tags-survey__slider-row';
        wrapper.appendChild(row);

        const label = document.createElement('span');
        label.className = 'trial-tags-survey__field-label';
        label.textContent = this.formatSliderLabel(fieldName);
        row.appendChild(label);

        const valueEl = document.createElement('span');
        valueEl.className = 'trial-tags-survey__slider-value';
        valueEl.textContent = this.formatFloat(this.response[fieldName]);
        row.appendChild(valueEl);

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
            valueEl.textContent = this.formatFloat(nextValue);
            this.updateNavigationState();
        });
        wrapper.appendChild(input);

        const scale = document.createElement('div');
        scale.className = 'trial-tags-survey__slider-scale';
        scale.innerHTML = '<span>0.00</span><span>1.00</span>';
        wrapper.appendChild(scale);

        return wrapper;
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

    togglePredefinedAction(value) {
        if (this.response.action.predefined.includes(value)) {
            this.response.action.predefined = this.response.action.predefined.filter((item) => item !== value);
            return;
        }
        this.response.action.predefined = [...this.response.action.predefined, value];
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

        if (stepKey === 'direction_action') {
            const hasAction = this.response.action.predefined.length > 0 || this.response.action.custom.trim() !== '';
            if (!hasAction) {
                return 'Choose at least one Action response before continuing.';
            }
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

    buildSurveyResponse() {
        return {
            urgency: this.response.urgency,
            intensity: this.response.intensity,
            direction: {
                leftRight: this.response.direction.leftRight,
                upDown: this.response.direction.upDown,
                forwardBackward: this.response.direction.forwardBackward
            },
            action: {
                predefined: [...this.response.action.predefined],
                custom: this.response.action.custom.trim()
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
            texture: {
                temperature: this.response.texture.temperature,
                hardness: this.response.texture.hardness,
                surface: this.response.texture.surface
            },
            confidence: this.response.confidence
        };
    }

    buildSelectedTags(surveyResponse) {
        const tags = [];
        const direction = surveyResponse.direction || {};
        const action = surveyResponse.action || {};
        const emotion = surveyResponse.emotion || {};
        const texture = surveyResponse.texture || {};

        const pushTag = (id, label, category, isCustom = false) => {
            tags.push({ id, label, category, isCustom });
        };

        if (direction.leftRight) {
            pushTag(`direction:leftRight:${this.slugify(direction.leftRight)}`, `Direction: ${direction.leftRight}`, 'direction');
        }
        if (direction.upDown) {
            pushTag(`direction:upDown:${this.slugify(direction.upDown)}`, `Direction: ${direction.upDown}`, 'direction');
        }
        if (direction.forwardBackward) {
            pushTag(`direction:forwardBackward:${this.slugify(direction.forwardBackward)}`, `Direction: ${direction.forwardBackward}`, 'direction');
        }

        (action.predefined || []).forEach((value) => {
            pushTag(`action:${this.slugify(value)}`, `Action: ${value}`, 'action');
        });

        if ((action.custom || '').trim()) {
            const customValue = action.custom.trim();
            pushTag(`action:custom:${this.slugify(customValue)}`, `Action: ${customValue}`, 'action', true);
        }

        Object.entries(emotion).forEach(([facet, value]) => {
            if (!value) return;
            pushTag(`emotion:${facet}:${this.slugify(value)}`, `${this.toTitleCase(facet)}: ${value}`, `emotion:${facet}`);
        });

        if (texture.temperature) {
            pushTag(`texture:temperature:${this.slugify(texture.temperature)}`, `Temperature: ${texture.temperature}`, 'texture:temperature');
        }
        if (texture.hardness) {
            pushTag(`texture:hardness:${this.slugify(texture.hardness)}`, `Hardness: ${texture.hardness}`, 'texture:hardness');
        }
        if (texture.surface) {
            pushTag(`texture:surface:${this.slugify(texture.surface)}`, `Surface: ${texture.surface}`, 'texture:surface');
        }

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
        if (button && this.footerEl) {
            button.classList.add('trial-tags-survey__nav-btn', 'trial-tags-survey__nav-btn--primary');
            this.footerEl.appendChild(button);
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
