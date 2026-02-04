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
        this.participants = options.participants || []; // Array of {id, code, ...}
        this.locations = options.locations || []; // Array of {id, name, ...}
        this.initialData = options.initialData || null; // Initial form data
        
        // Callbacks
        this.onChange = options.onChange || null; // Called when any field changes
        this.onValidationChange = options.onValidationChange || null; // Called when validation state changes
        
        // Form state
        this.data = {
            participant_id: null,
            location_id: null,
            session_date: null,
            equipment_info: '',
            experimenter: '',
            notes: ''
        };
        
        // Validation state
        this.isValid = false;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize component
     */
    init() {
        // Load initial data if provided
        if (this.initialData) {
            this.data = { ...this.data, ...this.initialData };
        }
        
        // Set default session_date to now if not provided
        if (!this.data.session_date) {
            const now = new Date();
            this.data.session_date = now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
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
        
        // Create form
        const form = this.createForm();
        
        // Clear and append
        this.container.innerHTML = '';
        this.container.appendChild(header);
        this.container.appendChild(form);
    }
    
    /**
     * Create header (matches PATTERN LIBRARY style)
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'session-info__header';
        
        const headerText = document.createElement('span');
        headerText.className = 'session-info__header-text';
        headerText.textContent = 'SESSION';
        
        header.appendChild(headerText);
        return header;
    }
    
    /**
     * Create form with all fields
     */
    createForm() {
        const form = document.createElement('div');
        form.className = 'session-info__form';
        
        // Participant field
        const participantField = this.createSelectField({
            id: 'participant_id',
            label: 'Participant',
            required: true,
            options: this.participants.map(p => ({
                value: p.participant_id || p.id,
                text: p.participant_code || p.code || `Participant ${p.participant_id || p.id}`
            })),
            value: this.data.participant_id
        });
        form.appendChild(participantField);
        
        // Location field
        const locationField = this.createSelectField({
            id: 'location_id',
            label: 'Location',
            required: true,
            options: this.locations.map(l => ({
                value: l.location_id || l.id,
                text: l.name || `Location ${l.location_id || l.id}`
            })),
            value: this.data.location_id
        });
        form.appendChild(locationField);
        
        // Session date field
        const dateField = this.createDateTimeField({
            id: 'session_date',
            label: 'Date',
            required: true,
            value: this.data.session_date
        });
        form.appendChild(dateField);
        
        // Equipment info field
        const equipmentField = this.createTextField({
            id: 'equipment_info',
            label: 'Equipment',
            required: false,
            placeholder: 'Equipment information',
            value: this.data.equipment_info,
            maxLength: 255
        });
        form.appendChild(equipmentField);
        
        // Experimenter field
        const experimenterField = this.createTextField({
            id: 'experimenter',
            label: 'Experimenter',
            required: false,
            placeholder: 'Experimenter name',
            value: this.data.experimenter,
            maxLength: 100
        });
        form.appendChild(experimenterField);
        
        // Notes field
        const notesField = this.createTextareaField({
            id: 'notes',
            label: 'Notes',
            required: false,
            placeholder: 'Additional notes',
            value: this.data.notes
        });
        form.appendChild(notesField);
        
        return form;
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
        
        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = `Select ${label.toLowerCase()}...`;
        select.appendChild(emptyOption);
        
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
        
        // Listen for changes on all inputs
        const inputs = this.container.querySelectorAll('.session-info__input');
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
        const value = input.type === 'datetime-local' ? input.value : 
                     input.type === 'select-one' ? (input.value ? parseInt(input.value) : null) :
                     input.value;
        
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
        const requiredFields = ['participant_id', 'location_id', 'session_date'];
        const isValid = requiredFields.every(field => {
            const value = this.data[field];
            return value !== null && value !== '' && value !== undefined;
        });
        
        this.isValid = isValid;
        
        // Update visual validation state
        this.updateValidationState();
        
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
            
            if (fieldValid) {
                input.classList.remove('session-info__input--invalid');
            } else {
                input.classList.add('session-info__input--invalid');
            }
        });
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
                } else {
                    input.value = this.data[fieldId] || '';
                }
            }
        });
    }
    
    /**
     * Reset form
     */
    reset() {
        this.data = {
            participant_id: null,
            location_id: null,
            session_date: new Date().toISOString().slice(0, 16),
            equipment_info: '',
            experimenter: '',
            notes: ''
        };
        this.updateFormValues();
        this.validate();
    }
    
    /**
     * Update participants list
     */
    updateParticipants(participants) {
        this.participants = participants;
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
