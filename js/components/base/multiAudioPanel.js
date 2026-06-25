/**
 * MultiAudioPanel — bottom dock for NAD slot assignment and continuum slider.
 */
class MultiAudioPanel {
    constructor(options = {}) {
        this.containerId = options.containerId || 'multiAudioPanel';
        this.container = document.getElementById(this.containerId);
        this.slots = window.MultiAudioConstants?.SLOTS || [];
        this.activeSlotIndex = options.activeSlotIndex ?? 2;
        this.mixPosition = options.mixPosition ?? 0.5;
        this.assignments = this.slots.map(() => null);

        this.onActiveSlotChange = options.onActiveSlotChange || null;
        this.onAssignmentChange = options.onAssignmentChange || null;
        this.onMixPositionChange = options.onMixPositionChange || null;
        this.onFileDrop = options.onFileDrop || null;

        this._dragOverSlotIndex = null;
        this.render();
        this._bind();
    }

    setAssignments(assignments) {
        const sanitized = window.MultiAudioPathGains?.sanitizeSlotAssignments
            ? window.MultiAudioPathGains.sanitizeSlotAssignments(assignments)
            : (assignments || []);
        this.assignments = sanitized.map((slot) => (slot ? { ...slot } : null));
        this._renderBody();
    }

    setActiveSlotIndex(index) {
        this.activeSlotIndex = index;
        this._renderBody();
    }

    setMixPosition(position) {
        this.mixPosition = position;
        const slider = this.container.querySelector('[data-mix-slider]');
        if (slider) slider.value = String(position);
        this._renderBody();
    }

    render() {
        this.container.innerHTML = `
            <div class="multi-audio-dock">
                <div class="multi-audio-dock__slots" data-slot-list></div>
                <div class="multi-audio-dock__mix">
                    <div class="multi-audio-dock__mix-track">
                        <input type="range" min="0" max="1" step="0.001" value="${this.mixPosition}"
                            class="multi-audio-dock__slider" data-mix-slider
                            aria-label="NAD blend continuum">
                    </div>
                    <div class="multi-audio-dock__ticks" aria-hidden="true">
                        ${this.slots.map((slot) => `<span>${slot.label}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
        this._renderBody();
    }

    _slotWeight(index) {
        const weights = computeSlotWeights(this.mixPosition);
        return weights[index] || 0;
    }

    _hasOwnAssignment(index) {
        return window.MultiAudioConstants?.hasOwnSlotAssignment
            ? window.MultiAudioConstants.hasOwnSlotAssignment(this.assignments, index)
            : Boolean(this.assignments[index]?.path);
    }

    _usesFallback(index) {
        return window.MultiAudioConstants?.usesAttentiveFallback
            ? window.MultiAudioConstants.usesAttentiveFallback(this.assignments, index)
            : false;
    }

    _effectiveAssignment(index) {
        return window.MultiAudioConstants?.getEffectiveSlotAssignment
            ? window.MultiAudioConstants.getEffectiveSlotAssignment(this.assignments, index)
            : this.assignments[index];
    }

    _renderMetaRow(slot, index, weightPct) {
        const effective = this._effectiveAssignment(index);
        const weight = `<span class="multi-audio-dock__weight">${weightPct}%</span>`;
        const usesFallback = this._usesFallback(index);

        if (slot.amplifiesPairWhenEmpty) {
            const source = this.slots[slot.pairSourceIndex];
            let hint = '';
            if (usesFallback && source) {
                hint = `<span class="multi-audio-dock__derived" title="No pattern assigned — plays ${source.label} at double volume">2× ${source.label}</span>`;
            } else if (!this._hasOwnAssignment(index) && source) {
                hint = `<span class="multi-audio-dock__derived multi-audio-dock__derived--muted">Default: 2× ${source.label}</span>`;
            }
            return `
                <div class="multi-audio-dock__meta">
                    ${hint || '<span class="multi-audio-dock__meta-spacer"></span>'}
                    ${effective ? weight : ''}
                </div>
            `;
        }

        if (!effective) {
            return '<div class="multi-audio-dock__meta" aria-hidden="true"><span class="multi-audio-dock__meta-spacer"></span></div>';
        }

        return `<div class="multi-audio-dock__meta">${weight}</div>`;
    }

    _renderBody() {
        const list = this.container.querySelector('[data-slot-list]');
        if (!list) return;

        list.innerHTML = this.slots.map((slot, index) => {
            const isActive = index === this.activeSlotIndex;
            const color = window.MultiAudioConstants.getSlotColor(slot);
            const weight = this._slotWeight(index);
            const weightPct = Math.round(weight * 100);
            const stored = this.assignments[index];
            const effective = this._effectiveAssignment(index);
            const usesFallback = this._usesFallback(index);
            const hasOwn = this._hasOwnAssignment(index);
            const isEmpty = !effective;

            let fileLine;
            if (hasOwn) {
                fileLine = `<span class="multi-audio-dock__file font-mono">${stored.name}</span>`;
            } else if (usesFallback && effective) {
                fileLine = `<span class="multi-audio-dock__file font-mono">${effective.name}</span>`;
            } else if (slot.amplifiesPairWhenEmpty) {
                const sourceLabel = this.slots[slot.pairSourceIndex]?.label || 'Attentive';
                fileLine = `<span class="multi-audio-dock__file multi-audio-dock__file--empty">Drop or select · else 2× ${sourceLabel}</span>`;
            } else if (effective) {
                fileLine = `<span class="multi-audio-dock__file font-mono">${effective.name}</span>`;
            } else {
                fileLine = '<span class="multi-audio-dock__file multi-audio-dock__file--empty">Drop or select</span>';
            }

            return `
                <div class="multi-audio-dock__slot ${isActive ? 'multi-audio-dock__slot--active' : ''} ${usesFallback ? 'multi-audio-dock__slot--fallback' : ''} ${isEmpty ? 'multi-audio-dock__slot--empty' : ''}"
                    data-slot-index="${index}"
                    style="--slot-color:${color};--slot-weight:${weight}">
                    <div class="multi-audio-dock__slot-frame">
                        <div class="multi-audio-dock__slot-main">
                            <div class="multi-audio-dock__slot-top">
                                <button type="button" class="multi-audio-dock__slot-select" data-slot-select="${index}">
                                    <span class="multi-audio-dock__slot-head">
                                        <span class="multi-audio-dock__dot" aria-hidden="true"></span>
                                        <span class="multi-audio-dock__label">${slot.label}</span>
                                    </span>
                                </button>
                            </div>
                            ${fileLine}
                            ${this._renderMetaRow(slot, index, weightPct)}
                        </div>
                        <div class="multi-audio-dock__slot-tools">
                            ${hasOwn ? `<button type="button" class="multi-audio-dock__clear" data-clear-slot="${index}" title="Clear slot" aria-label="Clear ${slot.label}">×</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this._updateDropHighlight();
    }

    _parseDroppedFile(event) {
        const dragType = window.MultiAudioConstants?.PATTERN_DRAG_TYPE || 'application/x-sail-pattern';
        let raw = event.dataTransfer?.getData(dragType);
        if (!raw) {
            const plain = event.dataTransfer?.getData('text/plain');
            if (plain) {
                raw = JSON.stringify({ name: plain, path: `audio_files/${plain}` });
            }
        }
        if (window.MultiAudioConstants?.parsePatternDragPayload) {
            return window.MultiAudioConstants.parsePatternDragPayload(raw);
        }
        try {
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    _acceptsPatternDrag(event) {
        if (!event.dataTransfer) return false;
        const types = Array.from(event.dataTransfer.types || []);
        const dragType = window.MultiAudioConstants?.PATTERN_DRAG_TYPE || 'application/x-sail-pattern';
        return types.includes(dragType) || types.includes('text/plain');
    }

    _updateDropHighlight() {
        this.container.querySelectorAll('[data-slot-index]').forEach((slotEl) => {
            const index = Number(slotEl.dataset.slotIndex);
            slotEl.classList.toggle(
                'multi-audio-dock__slot--drop-target',
                this._dragOverSlotIndex === index
            );
        });
    }

    _clearDropHighlight() {
        this._dragOverSlotIndex = null;
        this._updateDropHighlight();
    }

    _bind() {
        this.container.addEventListener('click', (event) => {
            const clearBtn = event.target.closest('[data-clear-slot]');
            if (clearBtn) {
                event.stopPropagation();
                const index = Number(clearBtn.dataset.clearSlot);
                this.assignments[index] = null;
                this._renderBody();
                if (this.onAssignmentChange) this.onAssignmentChange(this.assignments);
                return;
            }

            const selectBtn = event.target.closest('[data-slot-select]');
            const slotMain = event.target.closest('.multi-audio-dock__slot-main');
            if ((selectBtn || slotMain) && !event.target.closest('[data-clear-slot]')) {
                const slotEl = event.target.closest('[data-slot-index]');
                if (!slotEl) return;
                const index = Number(slotEl.dataset.slotIndex);
                this.activeSlotIndex = index;
                this._renderBody();
                if (this.onActiveSlotChange) this.onActiveSlotChange(this.activeSlotIndex);
            }
        });

        const slider = this.container.querySelector('[data-mix-slider]');
        if (slider) {
            slider.addEventListener('input', () => {
                this.mixPosition = Number(slider.value);
                this._renderBody();
                if (this.onMixPositionChange) this.onMixPositionChange(this.mixPosition);
            });
        }

        this.container.addEventListener('dragover', (event) => {
            const types = Array.from(event.dataTransfer?.types || []);
            const isPatternDrag = this._acceptsPatternDrag(event)
                || (types.length === 0 && event.dataTransfer?.effectAllowed === 'copy');
            if (!isPatternDrag) return;

            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';

            const slotEl = event.target.closest('[data-slot-index]');
            if (!slotEl) return;

            const index = Number(slotEl.dataset.slotIndex);
            if (this._dragOverSlotIndex !== index) {
                this._dragOverSlotIndex = index;
                this._updateDropHighlight();
            }
        });

        this.container.addEventListener('dragleave', (event) => {
            if (!this.container.contains(event.relatedTarget)) {
                this._clearDropHighlight();
            }
        });

        this.container.addEventListener('drop', (event) => {
            event.preventDefault();
            event.stopPropagation();

            const slotEl = event.target.closest('[data-slot-index]');
            this._clearDropHighlight();
            if (!slotEl) return;

            const file = this._parseDroppedFile(event);
            if (!file || !this.onFileDrop) return;

            const index = Number(slotEl.dataset.slotIndex);
            this.activeSlotIndex = index;
            this.onFileDrop(index, file);
        });

        this.container.addEventListener('dragend', () => {
            this._clearDropHighlight();
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiAudioPanel;
}
