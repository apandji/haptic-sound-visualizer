/**
 * MultiAudioMixer — simultaneous playback with per-path gain from NAD slot weights.
 */
class MultiAudioMixer {
    constructor(options = {}) {
        if (!options.loadSoundFn) {
            throw new Error('MultiAudioMixer requires loadSoundFn');
        }

        this.loadSoundFn = options.loadSoundFn;
        this.defaultLoop = options.defaultLoop !== false;
        this.onPlayStateChange = options.onPlayStateChange || null;

        this.slots = Array(window.MultiAudioConstants?.SLOT_COUNT || 5).fill(null);
        this.mixPosition = 0.5;
        this.tracks = new Map();
        this.isPlaying = false;
        this._syncPromise = Promise.resolve();
    }

    setSlotAssignments(slots) {
        const sanitized = window.MultiAudioPathGains?.sanitizeSlotAssignments
            ? window.MultiAudioPathGains.sanitizeSlotAssignments(slots)
            : (slots || []);
        this.slots = sanitized.map((slot) => (slot ? { ...slot } : null));
        while (this.slots.length < (window.MultiAudioConstants?.SLOT_COUNT || 5)) {
            this.slots.push(null);
        }
        this.slots = this.slots.slice(0, window.MultiAudioConstants?.SLOT_COUNT || 5);
        this._syncPromise = this._syncPromise.then(() => this._syncTracks());
        return this._syncPromise;
    }

    setSlotAssignment(index, file) {
        if (index < 0 || index >= this.slots.length) return this._syncPromise;

        if (file && window.MultiAudioPathGains?.validateSlotAssignment) {
            const check = window.MultiAudioPathGains.validateSlotAssignment(this.slots, index, file);
            if (!check.ok) {
                window.AppUI?.showToast?.(check.reason, { variant: 'warning' });
                return this._syncPromise;
            }
        }

        this.slots[index] = file
            ? {
                name: file.name,
                path: window.MultiAudioConstants.normalizeMultiAudioPath(
                    file.path || `audio_files/${file.name}`
                )
            }
            : null;
        this._syncPromise = this._syncPromise.then(() => this._syncTracks());
        return this._syncPromise;
    }

    setMixPosition(position) {
        this.mixPosition = Math.max(0, Math.min(1, Number(position)));
        this._applyVolumes();
    }

    getMixPosition() {
        return this.mixPosition;
    }

    getSlotAssignments() {
        return this.slots.map((slot) => (slot ? { ...slot } : null));
    }

    hasAssignments() {
        if (window.MultiAudioPathGains?.hasAudibleAssignments) {
            return window.MultiAudioPathGains.hasAudibleAssignments(this.slots);
        }
        return this.slots.some((slot) => Boolean(slot?.path));
    }

    _getPathGains() {
        if (window.MultiAudioPathGains?.computePathGains) {
            return window.MultiAudioPathGains.computePathGains(this.slots, this.mixPosition);
        }
        const weights = computeSlotWeights(this.mixPosition);
        const pathGains = new Map();
        this.slots.forEach((slot, index) => {
            if (!slot?.path) return;
            const path = window.MultiAudioConstants.normalizeMultiAudioPath(slot.path);
            pathGains.set(path, (pathGains.get(path) || 0) + weights[index]);
        });
        return pathGains;
    }

    _applyVolumes() {
        const pathGains = this._getPathGains();
        const maxGain = window.MultiAudioPathGains?.DISRUPTIVE_GAIN_MULTIPLIER || 2;
        this.tracks.forEach((soundFile, path) => {
            const gain = Math.min(maxGain, pathGains.get(path) || 0);
            try {
                soundFile.setVolume(gain);
            } catch (error) {
                console.warn('MultiAudioMixer: could not set volume', error);
            }
        });
    }

    _loadTrack(path) {
        return new Promise((resolve, reject) => {
            try {
                const soundFile = this.loadSoundFn(
                    path,
                    () => {
                        setTimeout(() => {
                            if (!soundFile?.isLoaded()) {
                                reject(new Error(`Track failed to load: ${path}`));
                                return;
                            }
                            soundFile.setLoop(this.defaultLoop);
                            this.tracks.set(path, soundFile);
                            this._applyVolumes();
                            if (this.isPlaying) {
                                soundFile.play();
                            }
                            resolve(soundFile);
                        }, 80);
                    },
                    (error) => reject(error)
                );
                if (soundFile) {
                    this.tracks.set(path, soundFile);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async _syncTracks() {
        const needed = new Set();
        const slotCount = window.MultiAudioConstants?.SLOT_COUNT || 5;

        for (let index = 0; index < slotCount; index += 1) {
            const slot = this.slots[index];
            if (slot?.path) {
                needed.add(window.MultiAudioConstants.normalizeMultiAudioPath(slot.path));
            }
        }

        const pairSource = window.MultiAudioConstants?.getDisruptivePairSource?.() || { 0: 1, 4: 3 };
        Object.entries(pairSource).forEach(([disruptiveIndex, attentiveIndex]) => {
            const dIndex = Number(disruptiveIndex);
            const aIndex = Number(attentiveIndex);
            if (window.MultiAudioPathGains?.hasOwnSlotAssignment?.(this.slots, dIndex)) return;
            const source = this.slots[aIndex];
            if (source?.path) {
                needed.add(window.MultiAudioConstants.normalizeMultiAudioPath(source.path));
            }
        });

        for (const [path, soundFile] of [...this.tracks.entries()]) {
            if (!needed.has(path)) {
                try {
                    soundFile.stop();
                } catch (error) {
                    console.warn('MultiAudioMixer: stop failed', error);
                }
                this.tracks.delete(path);
            }
        }

        const loadPromises = [];
        needed.forEach((path) => {
            if (this.tracks.has(path)) {
                const existing = this.tracks.get(path);
                if (existing?.isLoaded()) return;
            }
            loadPromises.push(this._loadTrack(path).catch((error) => {
                console.error('MultiAudioMixer: load failed', path, error);
                this.tracks.delete(path);
            }));
        });

        await Promise.all(loadPromises);
        this._applyVolumes();
    }

    getMixVisualizationState() {
        const weights = computeSlotWeights(this.mixPosition);
        const slots = window.MultiAudioConstants?.SLOTS || [];

        return slots.map((meta, index) => {
            const effective = window.MultiAudioConstants?.getEffectiveSlotAssignment
                ? window.MultiAudioConstants.getEffectiveSlotAssignment(this.slots, index)
                : this.slots[index];
            const path = effective?.path
                ? window.MultiAudioConstants.normalizeMultiAudioPath(effective.path)
                : null;
            const usesFallback = window.MultiAudioConstants?.usesAttentiveFallback
                ? window.MultiAudioConstants.usesAttentiveFallback(this.slots, index)
                : false;

            return {
                slotIndex: index,
                slotId: meta.id,
                label: meta.label,
                side: meta.side,
                amplifiesPairWhenEmpty: Boolean(meta.amplifiesPairWhenEmpty),
                pairSourceIndex: meta.pairSourceIndex ?? null,
                usesPairFallback: usesFallback,
                color: window.MultiAudioConstants.getSlotColor(meta),
                weight: weights[index],
                path,
                name: effective?.name || null,
                soundFile: path ? this.tracks.get(path) || null : null
            };
        });
    }

    async play() {
        if (!this.hasAssignments()) return;

        await this._syncPromise;
        this.tracks.forEach((soundFile) => {
            if (soundFile?.isLoaded() && !soundFile.isPlaying()) {
                soundFile.play();
            }
        });
        this.isPlaying = true;
        if (this.onPlayStateChange) this.onPlayStateChange(true);
    }

    pause() {
        this.tracks.forEach((soundFile) => {
            if (soundFile?.isPlaying()) {
                soundFile.pause();
            }
        });
        this.isPlaying = false;
        if (this.onPlayStateChange) this.onPlayStateChange(false);
    }

    stop() {
        this.tracks.forEach((soundFile) => {
            try {
                soundFile.stop();
            } catch (error) {
                console.warn('MultiAudioMixer: stop failed', error);
            }
        });
        this.isPlaying = false;
        if (this.onPlayStateChange) this.onPlayStateChange(false);
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    isAnyPlaying() {
        return [...this.tracks.values()].some((soundFile) => soundFile?.isPlaying());
    }

    destroy() {
        this.stop();
        this.tracks.clear();
        this.slots = this.slots.map(() => null);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiAudioMixer;
}
