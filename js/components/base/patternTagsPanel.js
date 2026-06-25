/**
 * PatternTagsPanel — classification block on the Pattern view.
 *
 * Tag chips (defaults + custom, multiple allowed, "+ tag" creates new ones),
 * a one-line data digest (slot a future LLM synthesis can replace), and
 * analyst notes. Tags + notes save together to the DB.
 *
 * Data-driven suggestion hints: default tags the rule-based scorer suggests
 * but the analyst hasn't applied render dashed.
 */
class PatternTagsPanel {
    constructor(options = {}) {
        this.containerId = options.containerId || 'patternTagsPanel';
        this.container = document.getElementById(this.containerId);
        this.onSave = options.onSave || null;          // ({patternName, tagIds, notes}) => Promise
        this.onCreateTag = options.onCreateTag || null; // (name) => Promise<tag>

        if (!this.container) {
            console.error(`PatternTagsPanel: Container #${this.containerId} not found`);
            return;
        }

        this.entry = null;
        this.tags = [];
        this.draft = { tagIds: new Set(), notes: '' };
        this.saving = false;
        this.savedAt = null;
        this.container.classList.add('pattern-tags');
    }

    /**
     * @param {Object} entry      landscape entry from getCorpusLandscape()
     * @param {Array}  tags       full tag vocabulary [{id, name, color, isDefault}]
     * @param {Array}  assigned   tag ids currently assigned to this pattern
     * @param {Object} annotation { notes, updatedAt } or null
     */
    render(entry, tags, assigned = [], annotation = null) {
        if (!entry) {
            this.container.innerHTML = '';
            return;
        }

        this.entry = entry;
        this.tags = tags || [];
        this.draft = {
            tagIds: new Set(assigned || []),
            notes: annotation?.notes || ''
        };
        this.savedAt = annotation?.updatedAt || null;

        this.container.innerHTML = `
            <p class="pattern-tags__digest">${this._buildDigest(entry)}</p>
            <div class="pattern-tags__row">
                <div class="pattern-tags__chips" data-tag-chips></div>
                <div class="pattern-tags__new" data-tag-new-wrap>
                    <button type="button" class="pattern-tags__new-btn" data-tag-new>+ tag</button>
                    <input type="text" class="pattern-tags__new-input" data-tag-new-input
                        maxlength="40" placeholder="New tag name…" hidden>
                </div>
            </div>
            <textarea class="pattern-tags__notes" data-tag-notes rows="2"
                placeholder="Notes — why does it belong there?">${this._escape(this.draft.notes)}</textarea>
            <div class="pattern-tags__save-row">
                <button type="button" class="pattern-tags__save-btn" data-tag-save>Save tags &amp; notes</button>
                <span class="pattern-tags__status" data-tag-status aria-live="polite"></span>
                ${this.savedAt ? `<span class="pattern-tags__saved-at">Saved ${this._escape(String(this.savedAt))}</span>` : ''}
            </div>
        `;

        this._renderChips();
        this._bind();
    }

    _suggestedTagIds() {
        const suggested = this.entry?.suggestion?.suggested || [];
        if (!suggested.length) return new Set();
        const ids = new Set();
        suggested.forEach(bucketId => {
            const tag = this.tags.find(t =>
                t.isDefault && t.name.toLowerCase() === bucketId.toLowerCase()
            );
            if (tag) ids.add(tag.id);
        });
        return ids;
    }

    _renderChips() {
        const chipsEl = this.container.querySelector('[data-tag-chips]');
        if (!chipsEl) return;
        const suggestedIds = this._suggestedTagIds();
        const query = (this._matchQuery || '').toLowerCase();

        chipsEl.innerHTML = this.tags.map(tag => {
            const on = this.draft.tagIds.has(tag.id);
            const suggested = !on && suggestedIds.has(tag.id);
            const matches = query && tag.name.toLowerCase().includes(query);
            const dimmed = query && !matches;
            return `
                <button type="button"
                    class="pattern-tags__chip ${on ? 'pattern-tags__chip--on' : ''} ${suggested ? 'pattern-tags__chip--suggested' : ''} ${matches ? 'pattern-tags__chip--match' : ''} ${dimmed ? 'pattern-tags__chip--dim' : ''}"
                    style="--tag-color:${window.AppUI?.sanitizeCssColor ? window.AppUI.sanitizeCssColor(tag.color) : (tag.color || 'var(--color-accent)')}"
                    data-tag-id="${tag.id}"
                    aria-pressed="${on}"
                    ${suggested ? 'title="Suggested by the data — click to apply"' : ''}>
                    ${this._escape(tag.name)}${suggested ? '<span class="pattern-tags__chip-hint">?</span>' : ''}
                </button>
            `;
        }).join('');

        chipsEl.querySelectorAll('[data-tag-id]').forEach(chip => {
            chip.addEventListener('click', () => {
                const id = Number(chip.dataset.tagId);
                if (this.draft.tagIds.has(id)) this.draft.tagIds.delete(id);
                else this.draft.tagIds.add(id);
                this._renderChips();
            });
        });
    }

    _bind() {
        const notesEl = this.container.querySelector('[data-tag-notes]');
        if (notesEl) {
            notesEl.addEventListener('input', () => { this.draft.notes = notesEl.value; });
        }

        // While the new-tag input is open, clicking a (matched) chip must not
        // blur the input first — the blur re-render would swallow the click.
        const chipsWrap = this.container.querySelector('[data-tag-chips]');
        if (chipsWrap) {
            chipsWrap.addEventListener('mousedown', (event) => {
                const input = this.container.querySelector('[data-tag-new-input]');
                if (input && !input.hidden) event.preventDefault();
            });
        }

        const saveBtn = this.container.querySelector('[data-tag-save]');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this._handleSave(saveBtn));
        }

        const newBtn = this.container.querySelector('[data-tag-new]');
        const newInput = this.container.querySelector('[data-tag-new-input]');
        if (newBtn && newInput) {
            newBtn.addEventListener('click', () => {
                newBtn.hidden = true;
                newInput.hidden = false;
                newInput.focus();
            });
            const closeInput = () => {
                newInput.value = '';
                newInput.hidden = true;
                newBtn.hidden = false;
                if (this._matchQuery) {
                    this._matchQuery = '';
                    this._renderChips();
                }
            };

            // Live-match the vocabulary while typing so the analyst sees
            // existing tags light up instead of creating near-duplicates.
            newInput.addEventListener('input', () => {
                this._matchQuery = newInput.value.trim();
                this._renderChips();
            });

            newInput.addEventListener('keydown', async (event) => {
                if (event.key === 'Escape') { closeInput(); return; }
                if (event.key !== 'Enter') return;
                const name = newInput.value.trim();
                if (!name || !this.onCreateTag) { closeInput(); return; }

                // Exact match (case-insensitive) selects the existing tag
                // rather than creating a duplicate.
                const existing = this.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
                if (existing) {
                    this.draft.tagIds.add(existing.id);
                    closeInput();
                    return;
                }

                newInput.disabled = true;
                try {
                    const tag = await this.onCreateTag(name);
                    if (tag) {
                        if (!this.tags.some(t => t.id === tag.id)) this.tags.push(tag);
                        this.draft.tagIds.add(tag.id);
                    }
                } catch (err) {
                    console.error('PatternTagsPanel: tag creation failed', err);
                } finally {
                    newInput.disabled = false;
                    closeInput();
                }
            });
            newInput.addEventListener('blur', () => closeInput());
        }
    }

    async _handleSave(saveBtn) {
        if (this.saving || !this.onSave || !this.entry) return;
        const statusEl = this.container.querySelector('[data-tag-status]');
        this.saving = true;
        saveBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Saving…';

        try {
            await this.onSave({
                patternName: this.entry.name,
                tagIds: Array.from(this.draft.tagIds),
                notes: this.draft.notes
            });
            if (statusEl) statusEl.textContent = 'Saved.';
        } catch (err) {
            console.error('PatternTagsPanel: save failed', err);
            if (statusEl) statusEl.textContent = 'Save failed — try again.';
        } finally {
            this.saving = false;
            saveBtn.disabled = false;
        }
    }

    /**
     * Deterministic synthesis of the pattern's profile. Designed so a future
     * LLM-generated summary can replace this text in the same slot.
     */
    _buildDigest(entry) {
        if (!entry.surveyedCount) {
            return 'No surveyed trials yet — run more tests to build a profile.';
        }

        const band = (value) => {
            if (value < 0.33) return 'low';
            if (value < 0.66) return 'moderate';
            return 'high';
        };
        const spreadWord = (stat) => {
            const iqr = stat.q3 - stat.q1;
            if (iqr <= 0.15) return 'tight spread';
            if (iqr <= 0.35) return 'moderate spread';
            return 'wide spread';
        };

        const parts = [];
        const u = entry.urgency;
        const i = entry.intensity;
        parts.push(
            `${this._capitalize(band(u.median))} urgency (${u.median.toFixed(2)} median, ${spreadWord(u)})` +
            ` and ${band(i.median)} intensity (${i.median.toFixed(2)}, ${spreadWord(i)})` +
            ` across ${entry.surveyedCount} surveyed trial${entry.surveyedCount === 1 ? '' : 's'}.`
        );

        const leans = [...(entry.binaryLeanings || []), ...(entry.vibeLeanings || [])]
            .filter(row => row.lean && row.answered > 0 && row.lean.pct >= 60)
            .map(row => `${row.lean.label} (${row.lean.pct}%)`);
        if (leans.length) {
            parts.push(`Trials leaned ${leans.join(', ')}.`);
        }

        if (entry.topActions?.length) {
            parts.push(`Top action: ${entry.topActions[0].action}.`);
        }

        return this._escape(parts.join(' '));
    }

    _capitalize(value) {
        const text = String(value || '');
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    _escape(value) {
        if (window.AppUI?.escapeHtml) return window.AppUI.escapeHtml(value);
        return String(value ?? '');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternTagsPanel;
}
