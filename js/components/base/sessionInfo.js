/**
 * SessionInfo Component
 * Form for collecting session metadata (participant, location, date, equipment, experimenter, notes)
 */
class SessionInfo {
    constructor(options = {}) {
        this.containerId = options.containerId || 'sessionInfo';
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) {
            console.error(`SessionInfo: Container #${this.containerId} not found`);
            return;
        }
        
        // Configuration
        // Load participants from localStorage or use provided/default
        const storedParticipants = this.loadParticipantsFromStorage();
        this.participants = options.participants || storedParticipants || [
            { participant_id: 1, participant_code: 'P001' }
        ];
        // Locations are hardcoded (no longer passed as options)
        this.locations = [
            { location_id: 1, name: 'MDes Lab' },
            { location_id: 2, name: 'Steinberg 204' },
            { location_id: 3, name: 'Weil Hall' }
        ];
        this.initialData = options.initialData || null; // Initial form data
        
        // Callbacks
        this.onChange = options.onChange || null; // Called when any field changes
        this.onValidationChange = options.onValidationChange || null; // Called when validation state changes
        this.onStartSession = options.onStartSession || null; // Called when START SESSION is clicked
        
        // Time estimator (optional, can be provided or will use default)
        this.timeEstimator = options.timeEstimator || null;
        
        // Queue reference for validation (optional)
        this.queue = options.queue || null;
        this.getQueueItemCount = options.getQueueItemCount || null; // Callback to get queue count
        
        // Session estimate state
        this.patternCount = 0;
        
        // Session ID (generated, not user-editable)
        this.sessionId = this.generateSessionId();
        
        // Form state - default location to MDes Lab
        const defaultLocationId = this.locations.find(l => l.name === 'MDes Lab')?.location_id || this.locations[0]?.location_id || null;
        this.data = {
            participant_id: null,
            location_id: defaultLocationId, // Default to MDes Lab
            session_date: null, // Will be set when START SESSION is clicked
            equipment_info: '',
            experimenter: '',
            notes: ''
        };
        
        // Validation state
        this.isValid = false;
        this.isSessionStarted = false; // Track if session has been started
        
        // Initialize
        this.init();
    }
    
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        // Generate a unique ID: timestamp + random string
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `S${timestamp}${random}`.toUpperCase();
    }
    
    /**
     * Initialize component
     */
    init() {
        // Load initial data if provided
        if (this.initialData) {
            this.data = { ...this.data, ...this.initialData };
            // If session_date is provided, session is already started
            if (this.initialData.session_date) {
                this.isSessionStarted = true;
            }
        }
        
        // Render
        this.render();
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Validate initial state
        this.validate();
    }
    
    /**
     * Render the component
     */
    render() {
        if (!this.container) return;
        
        // Add component class
        this.container.classList.add('session-info');
        
        // Create header
        const header = this.createHeader();
        
        // Create session estimate info panel
        const estimatePanel = this.createEstimatePanel();
        this.estimatePanelElement = estimatePanel; // Store reference
        
        // Create form
        const form = this.createForm();
        
        // Create footer with START SESSION button
        const footer = this.createFooter();
        
        // Clear and append
        this.container.innerHTML = '';
        this.container.appendChild(header);
        if (estimatePanel) {
            this.container.appendChild(estimatePanel);
            // Initially hide if no patterns
            this.updateEstimatePanelVisibility();
        }
        this.container.appendChild(form);
        this.container.appendChild(footer);
    }
    
    /**
     * Create header (matches PATTERN LIBRARY style)
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'session-info__header';
        
        const headerLeft = document.createElement('div');
        headerLeft.className = 'session-info__header-left';
        
        const headerText = document.createElement('span');
        headerText.className = 'session-info__header-text';
        headerText.textContent = 'SESSION';
        headerLeft.appendChild(headerText);
        
        const sessionIdDisplay = document.createElement('span');
        sessionIdDisplay.className = 'session-info__header-id';
        sessionIdDisplay.textContent = this.sessionId;
        headerLeft.appendChild(sessionIdDisplay);
        
        header.appendChild(headerLeft);
        return header;
    }
    
    /**
     * Create session estimate info panel
     */
    createEstimatePanel() {
        if (!this.timeEstimator) {
            return null; // Don't show panel if no time estimator provided
        }
        
        const panel = document.createElement('div');
        panel.className = 'session-info__estimate';
        
        // Pattern count section
        const patternSection = document.createElement('div');
        patternSection.className = 'session-info__estimate-section';
        
        const patternLabel = document.createElement('span');
        patternLabel.className = 'session-info__estimate-label';
        patternLabel.textContent = 'Patterns';
        patternSection.appendChild(patternLabel);
        
        const patternValue = document.createElement('span');
        patternValue.className = 'session-info__estimate-value session-info__estimate-value--patterns';
        this.patternValueElement = patternValue;
        patternSection.appendChild(patternValue);
        
        // Duration section
        const durationSection = document.createElement('div');
        durationSection.className = 'session-info__estimate-section';
        
        const durationLabel = document.createElement('span');
        durationLabel.className = 'session-info__estimate-label';
        durationLabel.textContent = 'Est. Duration';
        durationSection.appendChild(durationLabel);
        
        const durationValue = document.createElement('span');
        durationValue.className = 'session-info__estimate-value session-info__estimate-value--duration';
        this.durationValueElement = durationValue;
        durationSection.appendChild(durationValue);
        
        panel.appendChild(patternSection);
        panel.appendChild(durationSection);
        
        // Initial update - only if there are patterns
        if (this.patternCount > 0) {
            this.updateEstimateDisplay();
        } else {
            // Clear values if no patterns
            this.clearEstimateDisplay();
        }
        
        return panel;
    }
    
    /**
     * Update estimate panel visibility based on pattern count
     */
    updateEstimatePanelVisibility() {
        // Find estimate panel element (in case reference was lost after re-render)
        let estimatePanel = this.estimatePanelElement;
        if (!estimatePanel && this.container) {
            estimatePanel = this.container.querySelector('.session-info__estimate');
            if (estimatePanel) {
                this.estimatePanelElement = estimatePanel; // Store reference
            }
        }
        
        if (!estimatePanel) {
            return;
        }
        
        // Hide panel if no patterns, show if there are patterns
        // Use opacity and transform for smooth animation
        if (this.patternCount === 0) {
            // Clear values before hiding
            this.clearEstimateDisplay();
            estimatePanel.style.opacity = '0';
            estimatePanel.style.transform = 'translateY(-8px)';
            // Hide after animation completes
            setTimeout(() => {
                if (this.patternCount === 0 && estimatePanel) {
                    estimatePanel.style.display = 'none';
                }
            }, 200);
        } else {
            estimatePanel.style.display = '';
            // Trigger reflow to restart animation
            estimatePanel.offsetHeight;
            estimatePanel.style.opacity = '1';
            estimatePanel.style.transform = 'translateY(0)';
        }
    }
    
    /**
     * Clear estimate display values
     */
    clearEstimateDisplay() {
        // Find elements if references are lost
        if (!this.patternValueElement && this.container) {
            const panel = this.container.querySelector('.session-info__estimate');
            if (panel) {
                this.patternValueElement = panel.querySelector('.session-info__estimate-value--patterns');
                this.durationValueElement = panel.querySelector('.session-info__estimate-value--duration');
            }
        }
        
        if (this.patternValueElement) {
            this.patternValueElement.textContent = '';
        }
        if (this.durationValueElement) {
            this.durationValueElement.textContent = '';
        }
    }
    
    /**
     * Update session estimate display
     */
    updateEstimateDisplay() {
        // Ensure we have valid pattern count
        if (this.patternCount === 0) {
            this.clearEstimateDisplay();
            return;
        }
        
        // Find elements if references are lost
        if (!this.patternValueElement && this.container) {
            const panel = this.container.querySelector('.session-info__estimate');
            if (panel) {
                this.patternValueElement = panel.querySelector('.session-info__estimate-value--patterns');
                this.durationValueElement = panel.querySelector('.session-info__estimate-value--duration');
            }
        }
        
        if (!this.patternValueElement || !this.durationValueElement || !this.timeEstimator) {
            return;
        }
        
        const estimate = this.timeEstimator.getEstimate(this.patternCount);
        const patternText = estimate.patternCount === 1 ? 'pattern' : 'patterns';
        
        this.patternValueElement.textContent = `${estimate.patternCount} ${patternText}`;
        this.durationValueElement.textContent = estimate.formattedDuration;
    }
    
    /**
     * Update session estimate with new pattern count
     * @param {number} patternCount - Number of patterns in queue
     */
    updateSessionEstimate(patternCount) {
        this.patternCount = patternCount || 0;
        // Update visibility first (to hide panel if count is 0)
        this.updateEstimatePanelVisibility();
        // Then update display (only if panel is visible and count > 0)
        if (this.patternCount > 0) {
            // Small delay to ensure panel is visible before updating
            setTimeout(() => {
                if (this.patternCount > 0) {
                    this.updateEstimateDisplay();
                }
            }, 10);
        } else {
            // Clear values immediately when count is 0
            this.clearEstimateDisplay();
        }
    }
    
    /**
     * Create form with all fields
     */
    createForm() {
        const form = document.createElement('div');
        form.className = 'session-info__form';
        
        // Participant field with add button
        const participantFieldContainer = document.createElement('div');
        participantFieldContainer.className = 'session-info__field';
        
        // Label
        const participantLabel = document.createElement('label');
        participantLabel.className = 'session-info__label';
        participantLabel.setAttribute('for', `${this.containerId}_participant_id`);
        participantLabel.textContent = 'Participant Code *';
        participantFieldContainer.appendChild(participantLabel);
        
        // Select + Add button row
        const selectButtonRow = document.createElement('div');
        selectButtonRow.className = 'session-info__select-button-row';
        
        // Participant select dropdown
        const select = document.createElement('select');
        select.id = `${this.containerId}_participant_id`;
        select.className = 'session-info__input session-info__select';
        select.required = true;
        
        // Add empty option (placeholder, hidden from dropdown)
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Select participant...';
        emptyOption.disabled = true;
        emptyOption.selected = !this.data.participant_id;
        emptyOption.hidden = true; // Hide from dropdown list
        select.appendChild(emptyOption);
        
        // Add participant options
        this.participants.forEach(p => {
            const option = document.createElement('option');
            option.value = p.participant_id || p.id;
            option.textContent = p.participant_code || p.code || `Participant ${p.participant_id || p.id}`;
            if (this.data.participant_id && String(option.value) === String(this.data.participant_id)) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        // Style select text color based on whether placeholder is selected
        if (!this.data.participant_id) {
            select.style.color = '#999';
        } else {
            select.style.color = '#333';
        }
        
        selectButtonRow.appendChild(select);
        
        // Add button (shown when form is closed)
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'session-info__add-button';
        addButton.textContent = '+ Add';
        addButton.setAttribute('aria-label', 'Add new participant');
        this.participantAddButton = addButton; // Store reference
        addButton.addEventListener('click', () => {
            this.openParticipantForm();
        });
        selectButtonRow.appendChild(addButton);
        
        // Cancel and Save buttons (shown when form is open, initially hidden)
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'session-info__action-button session-info__action-button--cancel';
        cancelButton.textContent = 'Cancel';
        cancelButton.setAttribute('aria-label', 'Cancel adding participant');
        cancelButton.style.display = 'none';
        this.participantCancelButton = cancelButton; // Store reference
        cancelButton.addEventListener('click', () => {
            this.closeParticipantForm();
        });
        selectButtonRow.appendChild(cancelButton);
        
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'session-info__action-button session-info__action-button--save';
        saveButton.textContent = 'Save';
        saveButton.setAttribute('aria-label', 'Save new participant');
        saveButton.style.display = 'none';
        this.participantSaveButton = saveButton; // Store reference
        saveButton.addEventListener('click', () => {
            this.saveNewParticipant();
        });
        selectButtonRow.appendChild(saveButton);
        
        participantFieldContainer.appendChild(selectButtonRow);
        
        // Participant creation subform (initially hidden)
        const participantForm = document.createElement('div');
        participantForm.className = 'session-info__participant-form';
        participantForm.style.display = 'none';
        this.participantFormElement = participantForm;
        
        // Participant code (required)
        const codeField = this.createTextField({
            id: 'new_participant_code',
            label: 'Participant Code',
            required: true,
            placeholder: 'e.g., P001',
            value: '',
            maxLength: 50
        });
        participantForm.appendChild(codeField);
        
        // Age (optional)
        const ageField = this.createTextField({
            id: 'new_participant_age',
            label: 'Age',
            required: false,
            placeholder: 'Age',
            value: '',
            maxLength: 3
        });
        // Change input type to number
        const ageInput = ageField.querySelector('input');
        if (ageInput) {
            ageInput.type = 'number';
            ageInput.min = '1';
            ageInput.max = '150';
        }
        participantForm.appendChild(ageField);
        
        // Gender (optional dropdown)
        const genderOptions = [
            { value: 'Male', text: 'Male' },
            { value: 'Female', text: 'Female' },
            { value: 'Other', text: 'Other' },
            { value: 'Prefer not to say', text: 'Prefer not to say' }
        ];
        const genderField = this.createSelectField({
            id: 'new_participant_gender',
            label: 'Gender',
            required: false,
            options: genderOptions,
            value: ''
        });
        participantForm.appendChild(genderField);
        
        // Handedness (optional dropdown)
        const handednessOptions = [
            { value: 'Right', text: 'Right' },
            { value: 'Left', text: 'Left' },
            { value: 'Ambidextrous', text: 'Ambidextrous' }
        ];
        const handednessField = this.createSelectField({
            id: 'new_participant_handedness',
            label: 'Handedness',
            required: false,
            options: handednessOptions,
            value: ''
        });
        participantForm.appendChild(handednessField);
        
        // Notes (optional)
        const notesField = this.createTextareaField({
            id: 'new_participant_notes',
            label: 'Notes',
            required: false,
            placeholder: 'Additional notes about participant',
            value: ''
        });
        participantForm.appendChild(notesField);
        
        // No footer actions needed - actions are in the header row
        participantFieldContainer.appendChild(participantForm);
        
        // Location field - default to MDes Lab
        const defaultLocationId = this.locations.find(l => l.name === 'MDes Lab')?.location_id || this.locations[0]?.location_id || null;
        // Use existing data.location_id if set, otherwise use default
        const locationValue = this.data.location_id || defaultLocationId;
        
        const locationField = this.createSelectField({
            id: 'location_id',
            label: 'Location',
            required: true,
            options: this.locations.map(l => ({
                value: l.location_id || l.id,
                text: l.name || `Location ${l.location_id || l.id}`
            })),
            value: locationValue
        });
        
        // Ensure default location is set in data
        if (!this.data.location_id && defaultLocationId) {
            this.data.location_id = defaultLocationId;
        }
        
        // Update the select to show the selected value (default or existing)
        const locationSelect = locationField.querySelector('select');
        if (locationSelect && locationValue) {
            locationSelect.value = locationValue;
            locationSelect.style.color = '#333';
        }
        
        // Group: SESSION DETAILS (stacked)
        const sessionGroup = this.createFieldGroup('Session Details', false);
        sessionGroup.querySelector('.session-info__field-group-fields').appendChild(participantFieldContainer);
        sessionGroup.querySelector('.session-info__field-group-fields').appendChild(locationField);
        form.appendChild(sessionGroup);
        
        // Experimenter field (dropdown)
        const experimenterOptions = [
            { value: 'Jonathan', text: 'Jonathan' },
            { value: 'Long', text: 'Long' },
            { value: 'Noah', text: 'Noah' },
            { value: 'Pandji', text: 'Pandji' }
        ];
        const experimenterField = this.createSelectField({
            id: 'experimenter',
            label: 'Experimenter',
            required: false,
            options: experimenterOptions,
            value: this.data.experimenter
        });
        
        // Equipment info field
        const equipmentField = this.createTextField({
            id: 'equipment_info',
            label: 'Equipment',
            required: false,
            placeholder: 'Equipment information',
            value: this.data.equipment_info,
            maxLength: 255
        });
        
        // Notes field
        const sessionNotesField = this.createTextareaField({
            id: 'notes',
            label: 'Notes',
            required: false,
            placeholder: 'Additional notes',
            value: this.data.notes
        });
        
        // Group: METADATA (stacked)
        const metadataGroup = this.createFieldGroup('Metadata', false);
        metadataGroup.querySelector('.session-info__field-group-fields').appendChild(experimenterField);
        metadataGroup.querySelector('.session-info__field-group-fields').appendChild(equipmentField);
        metadataGroup.querySelector('.session-info__field-group-fields').appendChild(sessionNotesField);
        form.appendChild(metadataGroup);
        
        // START SESSION button - placed right after Notes field
        const startButtonContainer = document.createElement('div');
        startButtonContainer.className = 'session-info__start-button-container';
        
        const startButton = document.createElement('button');
        startButton.className = 'session-info__start-button';
        startButton.id = `${this.containerId}_start`;
        startButton.textContent = 'START SESSION';
        startButton.setAttribute('aria-label', 'Start session');
        startButton.disabled = !this.isValid || this.isSessionStarted;
        
        startButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!startButton.disabled) {
                this.startSession();
            }
        });
        
        startButtonContainer.appendChild(startButton);
        form.appendChild(startButtonContainer);
        
        // Store reference to button
        this.startButton = startButton;
        
        return form;
    }
    
    /**
     * Create field group container
     */
    createFieldGroup(title, twoColumn = false) {
        const group = document.createElement('div');
        group.className = 'session-info__field-group' + (twoColumn ? ' session-info__field-group--two-column' : '');
        
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'session-info__field-group-title';
            titleEl.textContent = title;
            group.appendChild(titleEl);
        }
        
        const fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'session-info__field-group-fields';
        group.appendChild(fieldsContainer);
        
        return group;
    }
    
    /**
     * Create select field
     */
    createSelectField({ id, label, required, options, value }) {
        const field = document.createElement('div');
        field.className = 'session-info__field';
        
        const labelEl = document.createElement('label');
        labelEl.className = 'session-info__label';
        labelEl.setAttribute('for', `${this.containerId}_${id}`);
        labelEl.textContent = label + (required ? ' *' : '');
        field.appendChild(labelEl);
        
        const select = document.createElement('select');
        select.id = `${this.containerId}_${id}`;
        select.className = 'session-info__input session-info__select';
        select.required = required;
        
        // Add empty option (placeholder, hidden from dropdown)
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = `Select ${label.toLowerCase()}...`;
        emptyOption.disabled = true;
        emptyOption.selected = !value;
        emptyOption.hidden = true; // Hide from dropdown list
        select.appendChild(emptyOption);
        
        // Style select when placeholder is selected
        if (!value) {
            select.style.color = '#999';
        }
        
        // Add options
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            if (value && String(opt.value) === String(value)) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        field.appendChild(select);
        return field;
    }
    
    /**
     * Create text input field
     */
    createTextField({ id, label, required, placeholder, value, maxLength }) {
        const field = document.createElement('div');
        field.className = 'session-info__field';
        
        const labelEl = document.createElement('label');
        labelEl.className = 'session-info__label';
        labelEl.setAttribute('for', `${this.containerId}_${id}`);
        labelEl.textContent = label + (required ? ' *' : '');
        field.appendChild(labelEl);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `${this.containerId}_${id}`;
        input.className = 'session-info__input';
        input.placeholder = placeholder || '';
        input.value = value || '';
        input.required = required;
        if (maxLength) {
            input.maxLength = maxLength;
        }
        
        field.appendChild(input);
        
        // Add error message container (for participant form fields)
        if (id && id.startsWith('new_participant_')) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'session-info__error-message';
            errorMsg.id = `${this.containerId}_${id}_error`;
            errorMsg.style.display = 'none';
            field.appendChild(errorMsg);
            
            // Add Enter key listener to save (except for textarea)
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // Find the save button and trigger it
                    const saveBtn = this.container.querySelector('.session-info__action-button--save');
                    if (saveBtn && saveBtn.style.display !== 'none') {
                        saveBtn.click();
                    }
                }
            });
            
            // Clear error when user starts typing
            input.addEventListener('input', () => {
                this.clearFieldError(id);
            });
        }
        
        return field;
    }
    
    /**
     * Create datetime-local input field
     */
    createDateTimeField({ id, label, required, value }) {
        const field = document.createElement('div');
        field.className = 'session-info__field';
        
        const labelEl = document.createElement('label');
        labelEl.className = 'session-info__label';
        labelEl.setAttribute('for', `${this.containerId}_${id}`);
        labelEl.textContent = label + (required ? ' *' : '');
        field.appendChild(labelEl);
        
        const input = document.createElement('input');
        input.type = 'datetime-local';
        input.id = `${this.containerId}_${id}`;
        input.className = 'session-info__input';
        input.value = value || '';
        input.required = required;
        
        field.appendChild(input);
        return field;
    }
    
    /**
     * Create textarea field
     */
    createTextareaField({ id, label, required, placeholder, value }) {
        const field = document.createElement('div');
        field.className = 'session-info__field';
        
        const labelEl = document.createElement('label');
        labelEl.className = 'session-info__label';
        labelEl.setAttribute('for', `${this.containerId}_${id}`);
        labelEl.textContent = label + (required ? ' *' : '');
        field.appendChild(labelEl);
        
        const textarea = document.createElement('textarea');
        textarea.id = `${this.containerId}_${id}`;
        textarea.className = 'session-info__input session-info__textarea';
        textarea.placeholder = placeholder || '';
        textarea.value = value || '';
        textarea.required = required;
        textarea.rows = 3;
        
        field.appendChild(textarea);
        return field;
    }
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (!this.container) return;
        
        // Listen for changes on all inputs, selects, and textareas
        const inputs = this.container.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.handleFieldChange(e.target);
            });
            input.addEventListener('input', (e) => {
                this.handleFieldChange(e.target);
            });
        });
    }
    
    /**
     * Handle field change
     */
    handleFieldChange(input) {
        const fieldId = input.id.replace(`${this.containerId}_`, '');
        let value;

        if (input.type === 'datetime-local') {
            value = input.value;
        } else if (input.tagName === 'SELECT') {
            // For select fields, check if it should be an integer or string
            // participant_id and location_id are integers, experimenter is a string
            if (fieldId === 'participant_id' || fieldId === 'location_id') {
                value = input.value ? parseInt(input.value) : null;
            } else {
                // String values (e.g., experimenter)
                value = input.value || '';
            }
            
            // Update select text color based on whether placeholder is selected
            if (value === null || value === '' || value === undefined) {
                input.style.color = '#999';
            } else {
                input.style.color = '#333';
            }
        } else {
            value = input.value;
        }
        
        // Update data
        this.data[fieldId] = value;
        
        // Validate
        const wasValid = this.isValid;
        this.validate();
        
        // Call onChange callback
        if (this.onChange) {
            this.onChange({
                field: fieldId,
                value: value,
                data: { ...this.data },
                isValid: this.isValid
            });
        }
        
        // Call validation change callback if state changed
        if (this.onValidationChange && wasValid !== this.isValid) {
            this.onValidationChange(this.isValid, { ...this.data });
        }
    }
    
    /**
     * Validate form
     */
    validate() {
        // Required fields: participant_id and location_id (session_date is set when session starts)
        const requiredFields = ['participant_id', 'location_id'];
        const isValid = requiredFields.every(field => {
            const value = this.data[field];
            return value !== null && value !== '' && value !== undefined;
        });
        
        this.isValid = isValid;
        
        // Update visual validation state
        this.updateValidationState();
        
        // Update START SESSION button state
        this.updateStartButton();
        
        return isValid;
    }
    
    /**
     * Update visual validation state
     */
    updateValidationState() {
        if (!this.container) return;
        
        const requiredInputs = this.container.querySelectorAll('.session-info__input[required]');
        requiredInputs.forEach(input => {
            const fieldId = input.id.replace(`${this.containerId}_`, '');
            const value = this.data[fieldId];
            const fieldValid = value !== null && value !== '' && value !== undefined;
            
            // Find or create error message element
            const field = input.closest('.session-info__field');
            let errorMessage = field ? field.querySelector('.session-info__error-message') : null;
            
            if (fieldValid) {
                input.classList.remove('session-info__input--invalid');
                if (errorMessage) {
                    errorMessage.style.display = 'none';
                }
            } else {
                input.classList.add('session-info__input--invalid');
                
                // Create error message if it doesn't exist
                if (!errorMessage && field) {
                    errorMessage = document.createElement('div');
                    errorMessage.className = 'session-info__error-message';
                    field.appendChild(errorMessage);
                }
                
                if (errorMessage) {
                    const fieldLabel = field.querySelector('.session-info__label');
                    const labelText = fieldLabel ? fieldLabel.textContent.replace(' *', '') : 'This field';
                    errorMessage.textContent = `${labelText} is required`;
                    errorMessage.style.display = 'block';
                }
            }
        });
        
        // Update header session ID display
        const sessionIdDisplay = this.container.querySelector('.session-info__header-id');
        if (sessionIdDisplay) {
            sessionIdDisplay.textContent = this.sessionId;
        }
    }
    
    /**
     * Get current form data
     */
    getData() {
        return { ...this.data };
    }
    
    /**
     * Set form data
     */
    setData(data) {
        this.data = { ...this.data, ...data };
        this.updateFormValues();
        this.validate();
    }
    
    /**
     * Update form input values from data
     */
    updateFormValues() {
        if (!this.container) return;
        
        Object.keys(this.data).forEach(fieldId => {
            const input = this.container.querySelector(`#${this.containerId}_${fieldId}`);
            if (input) {
                if (input.tagName === 'SELECT') {
                    input.value = this.data[fieldId] || '';
                    // Update select text color based on whether placeholder is selected
                    const value = this.data[fieldId];
                    if (value === null || value === '' || value === undefined) {
                        input.style.color = '#999';
                    } else {
                        input.style.color = '#333';
                    }
                } else {
                    input.value = this.data[fieldId] || '';
                }
            }
        });
    }
    
    /**
     * Create footer with EXPORT SESSIONS button (auxiliary function)
     */
    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'session-info__footer';
        
        // Export Sessions button (auxiliary function)
        const exportButton = document.createElement('button');
        exportButton.className = 'session-info__export-button';
        exportButton.id = 'exportSessionsBtn';
        exportButton.textContent = 'EXPORT SESSIONS';
        exportButton.setAttribute('aria-label', 'Export sessions');
        exportButton.disabled = true; // Enabled when sessions exist
        
        exportButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!exportButton.disabled && typeof window.exportSessionsToJSON === 'function') {
                window.exportSessionsToJSON();
            }
        });
        
        footer.appendChild(exportButton);
        
        // Store reference to export button
        this.exportButton = exportButton;
        
        return footer;
    }
    
    /**
     * Update START SESSION button state
     */
    updateStartButton() {
        if (this.startButton) {
            // Check if queue has items
            let queueHasItems = true;
            if (this.queue && typeof this.queue.getItems === 'function') {
                queueHasItems = this.queue.getItems().length > 0;
            } else if (this.getQueueItemCount) {
                queueHasItems = this.getQueueItemCount() > 0;
            } else if (this.patternCount !== undefined) {
                queueHasItems = this.patternCount > 0;
            }
            
            // Disable if form is invalid, session already started, or queue is empty
            this.startButton.disabled = !this.isValid || this.isSessionStarted || !queueHasItems;
            
            // Update button text/title to show why it's disabled
            if (this.startButton.disabled) {
                if (!queueHasItems) {
                    this.startButton.title = 'Add at least one pattern to the queue';
                } else if (!this.isValid) {
                    this.startButton.title = 'Please fill in all required fields';
                } else if (this.isSessionStarted) {
                    this.startButton.title = 'Session already started';
                }
            } else {
                this.startButton.title = 'Start session';
            }
        }
    }
    
    /**
     * Start session
     */
    startSession() {
        // Check queue has items
        let queueHasItems = true;
        if (this.queue && typeof this.queue.getItems === 'function') {
            queueHasItems = this.queue.getItems().length > 0;
        } else if (this.getQueueItemCount) {
            queueHasItems = this.getQueueItemCount() > 0;
        } else if (this.patternCount !== undefined) {
            queueHasItems = this.patternCount > 0;
        }
        
        if (!queueHasItems) {
            this.showValidationError('Please add at least one pattern to the queue before starting the session.');
            return;
        }
        
        if (!this.isValid) {
            this.showValidationError('Please fill in all required fields (Participant Code and Location).');
            // Scroll to first invalid field
            const firstInvalid = this.container.querySelector('.session-info__input--invalid');
            if (firstInvalid) {
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstInvalid.focus();
            }
            return;
        }
        
        if (this.isSessionStarted) {
            console.warn('SessionInfo: Session already started');
            return;
        }
        
        // Set session_date to current datetime
        const now = new Date();
        this.data.session_date = now.toISOString();
        this.isSessionStarted = true;
        
        // Update button state
        this.updateStartButton();
        
        // Call callback
        if (this.onStartSession) {
            this.onStartSession({
                sessionId: this.sessionId,
                data: { ...this.data }
            });
        }
    }
    
    /**
     * Show validation error message
     */
    showValidationError(message) {
        // Remove existing error message
        const existingError = this.container.querySelector('.session-info__validation-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'session-info__validation-error';
        errorDiv.textContent = message;
        
        // Insert after header
        const header = this.container.querySelector('.session-info__header');
        if (header && header.nextSibling) {
            this.container.insertBefore(errorDiv, header.nextSibling);
        } else if (header) {
            header.parentElement.insertBefore(errorDiv, header.nextSibling);
        }
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.style.opacity = '0';
                setTimeout(() => {
                    if (errorDiv.parentElement) {
                        errorDiv.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
    
    /**
     * Reset form
     */
    reset() {
        // Generate new session ID
        this.sessionId = this.generateSessionId();
        
        // Get default location (MDes Lab)
        const defaultLocationId = this.locations.find(l => l.name === 'MDes Lab')?.location_id || this.locations[0]?.location_id || null;
        
        this.data = {
            participant_id: null,
            location_id: defaultLocationId, // Default to MDes Lab
            session_date: null,
            equipment_info: '',
            experimenter: '',
            notes: ''
        };
        this.isSessionStarted = false;
        
        // Re-render to update session ID display
        this.render();
        this.attachEventListeners();
        this.validate();
    }
    
    /**
     * Get session ID
     */
    getSessionId() {
        return this.sessionId;
    }
    
    /**
     * Check if session has been started
     */
    getIsSessionStarted() {
        return this.isSessionStarted;
    }
    
    /**
     * Load participants from localStorage
     */
    loadParticipantsFromStorage() {
        try {
            const stored = localStorage.getItem('sessionInfo_participants');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('SessionInfo: Could not load participants from localStorage', e);
        }
        return null;
    }
    
    /**
     * Save participants to localStorage
     */
    saveParticipantsToStorage() {
        try {
            localStorage.setItem('sessionInfo_participants', JSON.stringify(this.participants));
        } catch (e) {
            console.warn('SessionInfo: Could not save participants to localStorage', e);
        }
    }
    
    /**
     * Open participant creation form
     */
    openParticipantForm() {
        // Re-find elements in case of re-render
        if (!this.participantFormElement) {
            this.participantFormElement = this.container.querySelector('.session-info__participant-form');
        }
        if (!this.participantAddButton) {
            this.participantAddButton = this.container.querySelector('.session-info__add-button');
        }
        if (!this.participantCancelButton) {
            this.participantCancelButton = this.container.querySelector('.session-info__action-button--cancel');
        }
        if (!this.participantSaveButton) {
            this.participantSaveButton = this.container.querySelector('.session-info__action-button--save');
        }
        
        if (!this.participantFormElement || !this.participantAddButton || !this.participantCancelButton || !this.participantSaveButton) return;
        
        // Show form
        this.participantFormElement.style.display = 'block';
        
        // Hide Add button, show Cancel and Save buttons
        this.participantAddButton.style.display = 'none';
        this.participantCancelButton.style.display = 'block';
        this.participantSaveButton.style.display = 'block';
        
        // Add Escape key listener to form
        this.participantFormKeyHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeParticipantForm();
            }
        };
        document.addEventListener('keydown', this.participantFormKeyHandler);
        
        // Focus first input
        const firstInput = this.participantFormElement.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 0);
        }
    }
    
    /**
     * Close participant creation form
     */
    closeParticipantForm() {
        // Re-find elements in case of re-render
        if (!this.participantFormElement) {
            this.participantFormElement = this.container.querySelector('.session-info__participant-form');
        }
        if (!this.participantAddButton) {
            this.participantAddButton = this.container.querySelector('.session-info__add-button');
        }
        if (!this.participantCancelButton) {
            this.participantCancelButton = this.container.querySelector('.session-info__action-button--cancel');
        }
        if (!this.participantSaveButton) {
            this.participantSaveButton = this.container.querySelector('.session-info__action-button--save');
        }
        
        if (!this.participantFormElement || !this.participantAddButton || !this.participantCancelButton || !this.participantSaveButton) return;
        
        // Remove Escape key listener
        if (this.participantFormKeyHandler) {
            document.removeEventListener('keydown', this.participantFormKeyHandler);
            this.participantFormKeyHandler = null;
        }
        
        // Hide form
        this.participantFormElement.style.display = 'none';
        
        // Show Add button, hide Cancel and Save buttons
        this.participantAddButton.style.display = 'block';
        this.participantCancelButton.style.display = 'none';
        this.participantSaveButton.style.display = 'none';
        
        // Clear form and errors
        this.clearParticipantForm();
        this.clearParticipantFormErrors();
    }
    
    /**
     * Toggle participant creation form visibility (for backward compatibility)
     */
    toggleParticipantForm() {
        // Re-find elements in case of re-render
        if (!this.participantFormElement) {
            this.participantFormElement = this.container.querySelector('.session-info__participant-form');
        }
        
        if (!this.participantFormElement) return;
        
        const isVisible = this.participantFormElement.style.display !== 'none';
        if (isVisible) {
            this.closeParticipantForm();
        } else {
            this.openParticipantForm();
        }
    }
    
    /**
     * Clear participant creation form
     */
    clearParticipantForm() {
        // Re-find the form element in case of re-render
        if (!this.participantFormElement) {
            this.participantFormElement = this.container.querySelector('.session-info__participant-form');
        }
        
        if (!this.participantFormElement) return;
        
        const inputs = this.participantFormElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.value = '';
            input.classList.remove('session-info__input--invalid');
        });
    }
    
    /**
     * Clear participant form error messages
     */
    clearParticipantFormErrors() {
        if (!this.participantFormElement) {
            this.participantFormElement = this.container.querySelector('.session-info__participant-form');
        }
        
        if (!this.participantFormElement) return;
        
        const errorMessages = this.participantFormElement.querySelectorAll('.session-info__error-message');
        errorMessages.forEach(msg => {
            msg.style.display = 'none';
            msg.textContent = '';
        });
    }
    
    /**
     * Show error message for a field
     */
    showFieldError(fieldId, message) {
        if (!this.participantFormElement) {
            this.participantFormElement = this.container.querySelector('.session-info__participant-form');
        }
        
        if (!this.participantFormElement) return;
        
        const errorMsg = this.participantFormElement.querySelector(`#${this.containerId}_${fieldId}_error`);
        const input = this.participantFormElement.querySelector(`#${this.containerId}_${fieldId}`);
        
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
        
        if (input) {
            input.classList.add('session-info__input--invalid');
        }
    }
    
    /**
     * Clear error message for a field
     */
    clearFieldError(fieldId) {
        if (!this.participantFormElement) {
            this.participantFormElement = this.container.querySelector('.session-info__participant-form');
        }
        
        if (!this.participantFormElement) return;
        
        const errorMsg = this.participantFormElement.querySelector(`#${this.containerId}_${fieldId}_error`);
        const input = this.participantFormElement.querySelector(`#${this.containerId}_${fieldId}`);
        
        if (errorMsg) {
            errorMsg.style.display = 'none';
            errorMsg.textContent = '';
        }
        
        if (input) {
            input.classList.remove('session-info__input--invalid');
        }
    }
    
    /**
     * Save new participant from form
     */
    saveNewParticipant() {
        // Re-find the form element in case of re-render
        if (!this.participantFormElement) {
            this.participantFormElement = this.container.querySelector('.session-info__participant-form');
        }
        
        if (!this.participantFormElement) return;
        
        // Get form values
        const codeInput = this.participantFormElement.querySelector(`#${this.containerId}_new_participant_code`);
        const ageInput = this.participantFormElement.querySelector(`#${this.containerId}_new_participant_age`);
        const genderSelect = this.participantFormElement.querySelector(`#${this.containerId}_new_participant_gender`);
        const handednessSelect = this.participantFormElement.querySelector(`#${this.containerId}_new_participant_handedness`);
        const notesTextarea = this.participantFormElement.querySelector(`#${this.containerId}_new_participant_notes`);
        
        const code = codeInput ? codeInput.value.trim() : '';
        
        // Clear previous errors
        this.clearParticipantFormErrors();
        
        // Validate required field
        if (!code) {
            this.showFieldError('new_participant_code', 'Participant code is required');
            if (codeInput) {
                codeInput.focus();
            }
            return;
        }
        
        // Check if participant already exists
        const exists = this.participants.some(p => 
            (p.participant_code || p.code || '').toLowerCase() === code.toLowerCase()
        );
        
        if (exists) {
            this.showFieldError('new_participant_code', `Participant "${code}" already exists`);
            if (codeInput) {
                codeInput.focus();
            }
            return;
        }
        
        // Generate new ID (simple increment from max ID)
        const maxId = Math.max(...this.participants.map(p => p.participant_id || p.id || 0), 0);
        const newParticipant = {
            participant_id: maxId + 1,
            participant_code: code,
            age: ageInput && ageInput.value ? parseInt(ageInput.value) : null,
            gender: genderSelect && genderSelect.value ? genderSelect.value : null,
            handedness: handednessSelect && handednessSelect.value ? handednessSelect.value : null,
            notes: notesTextarea && notesTextarea.value ? notesTextarea.value.trim() : null
        };
        
        this.participants.push(newParticipant);
        this.saveParticipantsToStorage();
        
        // Clear any errors
        this.clearParticipantFormErrors();
        
        // Hide form and clear it
        this.closeParticipantForm();
        
        // Update the participant select dropdown without full re-render
        const select = this.container.querySelector(`#${this.containerId}_participant_id`);
        if (select) {
            // Clear existing options (except empty option)
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            // Add all participants including the new one
            this.participants.forEach(p => {
                const option = document.createElement('option');
                option.value = p.participant_id || p.id;
                option.textContent = p.participant_code || p.code || `Participant ${p.participant_id || p.id}`;
                select.appendChild(option);
            });
            
            // Select the newly added participant
            select.value = newParticipant.participant_id;
        }
        
        // Update form data and validate
        this.data.participant_id = newParticipant.participant_id;
        this.validate();
        
        // Trigger change event
        if (select) {
            const changeEvent = new Event('change', { bubbles: true });
            select.dispatchEvent(changeEvent);
        }
    }
    
    /**
     * Update participants list
     */
    updateParticipants(participants) {
        this.participants = participants;
        this.saveParticipantsToStorage();
        // Re-render to update select options
        this.render();
        this.attachEventListeners();
    }
    
    /**
     * Update locations list
     */
    updateLocations(locations) {
        this.locations = locations;
        // Re-render to update select options
        this.render();
        this.attachEventListeners();
    }
    
    /**
     * Destroy component
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('session-info');
        }
    }
}
