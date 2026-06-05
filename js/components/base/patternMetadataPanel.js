/**
 * PatternMetadataPanel — audio metadata for a pattern.
 */
class PatternMetadataPanel {
    constructor(options = {}) {
        this.containerId = options.containerId || 'patternMetadataPanel';
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.className = 'pattern-metadata-panel';
        this.container.innerHTML = '<div class="pattern-metadata-panel__empty">No audio metadata available.</div>';
    }

    update(metadata) {
        if (!metadata) {
            this.render();
            return;
        }

        const rows = [
            ['Duration', metadata.durationSec != null ? `${metadata.durationSec.toFixed(2)} s` : '—'],
            ['RMS mean', metadata.rmsMean != null ? metadata.rmsMean.toFixed(4) : '—'],
            ['Stereo balance', metadata.stereoBalance != null ? metadata.stereoBalance.toFixed(4) : '—'],
            ['Stereo movement', metadata.stereoMovement != null ? metadata.stereoMovement.toFixed(4) : '—']
        ];

        this.container.innerHTML = `
            <div class="pattern-metadata-panel__grid">
                ${rows.map(([label, value]) => `
                    <div class="pattern-metadata-panel__item">
                        <div class="pattern-metadata-panel__label">${label}</div>
                        <div class="pattern-metadata-panel__value">${value}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternMetadataPanel;
}
