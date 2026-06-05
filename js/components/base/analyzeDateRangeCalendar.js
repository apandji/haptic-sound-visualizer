/**
 * AnalyzeDateRangeCalendar — inline month view for selecting a start/end date range.
 */
class AnalyzeDateRangeCalendar {
    constructor(options = {}) {
        this.container = options.container;
        this.onChange = options.onChange || null;
        this.dateFrom = options.dateFrom || '';
        this.dateTo = options.dateTo || '';
        this.dateBounds = options.dateBounds || { min: null, max: null };
        this.datesWithData = new Set(options.datesWithData || []);
        this.viewDate = this._initialViewDate();
        this.activePreset = 'all';
        if (this.container) this.render();
    }

    _initialViewDate() {
        const anchor = this.dateFrom || this.dateTo || this.dateBounds.max || this.dateBounds.min;
        if (anchor) return this._parseDate(anchor);
        return new Date();
    }

    _parseDate(value) {
        const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    _formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    setOptions(options = {}) {
        if (options.dateBounds) this.dateBounds = options.dateBounds;
        if (options.datesWithData) this.datesWithData = new Set(options.datesWithData);
        this.render();
    }

    setRange(dateFrom, dateTo) {
        this.dateFrom = dateFrom || '';
        this.dateTo = dateTo || '';
        if (this.dateFrom) this.viewDate = this._parseDate(this.dateFrom);
        this.activePreset = this._detectActivePreset();
        this.render();
    }

    clearRange() {
        this._applyPreset('all', { emit: true });
    }

    _todayIso() {
        return this._formatDate(new Date());
    }

    _offsetDate(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return this._formatDate(date);
    }

    _presetRanges() {
        const today = this._todayIso();
        return {
            all: { from: '', to: '' },
            'last-month': { from: this._offsetDate(-29), to: today },
            'last-week': { from: this._offsetDate(-6), to: today },
            today: { from: today, to: today }
        };
    }

    _detectActivePreset() {
        if (!this.dateFrom && !this.dateTo) return 'all';
        for (const [id, range] of Object.entries(this._presetRanges())) {
            if (id === 'all') continue;
            if (range.from === this.dateFrom && range.to === this.dateTo) return id;
        }
        return 'custom';
    }

    _applyPreset(presetId, options = {}) {
        const range = this._presetRanges()[presetId];
        if (!range) return;

        this.dateFrom = range.from;
        this.dateTo = range.to;
        this.activePreset = presetId;
        if (this.dateFrom) {
            this.viewDate = this._parseDate(this.dateFrom);
        }

        this.render();
        if (options.emit !== false) this._emitChange();
    }

    getRange() {
        if (this.dateFrom && !this.dateTo) {
            return { dateFrom: '', dateTo: '' };
        }
        return { dateFrom: this.dateFrom, dateTo: this.dateTo };
    }

    _emitChange() {
        if (this.onChange) this.onChange(this.getRange());
    }

    _shiftMonth(delta) {
        this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + delta, 1);
        this.render();
    }

    _handleDayClick(isoDate) {
        if (!this.dateFrom || (this.dateFrom && this.dateTo)) {
            this.dateFrom = isoDate;
            this.dateTo = '';
            this.activePreset = 'custom';
            this.render();
            return;
        }

        if (isoDate < this.dateFrom) {
            this.dateTo = this.dateFrom;
            this.dateFrom = isoDate;
        } else {
            this.dateTo = isoDate;
        }

        this.activePreset = this._detectActivePreset();
        this.render();
        this._emitChange();
    }

    _buildMonthGrid(year, month) {
        const firstOfMonth = new Date(year, month, 1);
        const startOffset = firstOfMonth.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells = [];

        for (let i = 0; i < startOffset; i += 1) {
            cells.push({ empty: true });
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(year, month, day);
            const isoDate = this._formatDate(date);
            const inRange = this.dateFrom && this.dateTo
                && isoDate >= this.dateFrom && isoDate <= this.dateTo;
            const isStart = isoDate === this.dateFrom;
            const isEnd = isoDate === this.dateTo;
            const isPendingEnd = this.dateFrom && !this.dateTo && isoDate === this.dateFrom;
            cells.push({
                empty: false,
                isoDate,
                label: day,
                inRange,
                isStart,
                isEnd: isEnd || isPendingEnd,
                hasData: this.datesWithData.has(isoDate),
                isToday: isoDate === this._formatDate(new Date())
            });
        }

        return cells;
    }

    _presetButtons() {
        const presets = [
            { id: 'all', label: 'All time' },
            { id: 'last-month', label: 'Last month' },
            { id: 'last-week', label: 'Last week' },
            { id: 'today', label: 'Today' }
        ];

        return presets.map(({ id, label }) => {
            const active = this.activePreset === id;
            return `
                <button type="button"
                    class="analyze-filters-chip ${active ? 'analyze-filters-chip--included' : ''}"
                    data-preset="${id}"
                    aria-pressed="${active}">
                    ${label}
                </button>
            `;
        }).join('');
    }

    render() {
        if (!this.container) return;

        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();
        const monthLabel = this.viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        const cells = this._buildMonthGrid(year, month);

        this.container.innerHTML = `
            <div class="analyze-date-range-calendar__presets">
                ${this._presetButtons()}
            </div>
            <div class="analyze-date-range-calendar__nav">
                <button type="button" class="analyze-date-range-calendar__nav-btn" data-action="prev" aria-label="Previous month">‹</button>
                <span class="analyze-date-range-calendar__month">${monthLabel}</span>
                <button type="button" class="analyze-date-range-calendar__nav-btn" data-action="next" aria-label="Next month">›</button>
            </div>
            <div class="analyze-date-range-calendar__weekdays" aria-hidden="true">
                ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(label => `<span>${label}</span>`).join('')}
            </div>
            <div class="analyze-date-range-calendar__grid" role="grid" aria-label="Date range">
                ${cells.map(cell => {
                    if (cell.empty) return '<span class="analyze-date-range-calendar__day analyze-date-range-calendar__day--empty"></span>';
                    const classes = ['analyze-date-range-calendar__day'];
                    if (cell.inRange) classes.push('analyze-date-range-calendar__day--in-range');
                    if (cell.isStart) classes.push('analyze-date-range-calendar__day--start');
                    if (cell.isEnd) classes.push('analyze-date-range-calendar__day--end');
                    if (cell.hasData) classes.push('analyze-date-range-calendar__day--has-data');
                    if (cell.isToday) classes.push('analyze-date-range-calendar__day--today');
                    return `
                        <button type="button"
                            class="${classes.join(' ')}"
                            data-date="${cell.isoDate}"
                            aria-label="${cell.label}"
                            aria-pressed="${cell.isStart || cell.isEnd || cell.inRange}">
                            ${cell.label}
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        this.container.querySelectorAll('[data-preset]').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                this._applyPreset(button.dataset.preset);
            });
        });
        this.container.querySelector('[data-action="prev"]').addEventListener('click', (event) => {
            event.stopPropagation();
            this._shiftMonth(-1);
        });
        this.container.querySelector('[data-action="next"]').addEventListener('click', (event) => {
            event.stopPropagation();
            this._shiftMonth(1);
        });
        this.container.querySelectorAll('[data-date]').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                this._handleDayClick(button.dataset.date);
            });
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyzeDateRangeCalendar;
}
