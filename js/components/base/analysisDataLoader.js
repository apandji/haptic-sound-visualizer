/**
 * AnalysisDataLoader
 * Loads session data from the database. UI is a single refresh control in the page header.
 */
class AnalysisDataLoader {
    constructor(options = {}) {
        this.onSessionsLoaded = options.onSessionsLoaded || null;
        this.refreshButton = options.refreshButton || null;
        this.sessions = [];
        this.isLoading = false;
    }

    async loadFromDatabase() {
        const cache = window.AppDataCache;
        const cached = cache?.get('analysis-sessions');
        if (Array.isArray(cached) && cached.length) {
            this.setSessions(cached);
        }

        this.setLoading(!cached?.length);
        try {
            const sessions = cache
                ? await cache.fetchJson('analysis-sessions', '/api/analysis/sessions', { ttlMs: 60 * 1000 })
                : await fetch('/api/analysis/sessions').then(r => r.json());

            if (!Array.isArray(sessions)) throw new Error('Invalid response payload');
            this.setSessions(sessions);
        } catch (err) {
            console.error('AnalysisDataLoader: Error loading database sessions', err);
            if (!cached?.length) {
                this.setErrorState(true);
            }
        } finally {
            this.setLoading(false);
        }
    }

    setSessions(newSessions) {
        this.sessions = Array.isArray(newSessions) ? [...newSessions] : [];
        this.setErrorState(false);
        this.notifySessionsLoaded();
    }

    notifySessionsLoaded() {
        if (this.onSessionsLoaded) {
            this.onSessionsLoaded(this.sessions);
        }
    }

    setLoading(isLoading) {
        this.isLoading = isLoading;
        if (!this.refreshButton) return;
        this.refreshButton.disabled = isLoading;
        this.refreshButton.classList.toggle('analyze-refresh-btn--loading', isLoading);
        this.refreshButton.classList.remove('analyze-refresh-btn--error');
    }

    setErrorState(hasError) {
        if (!this.refreshButton) return;
        this.refreshButton.classList.toggle('analyze-refresh-btn--error', hasError);
        if (hasError) {
            this.refreshButton.title = 'Reload failed — try again';
        } else {
            this.refreshButton.title = 'Reload from database';
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisDataLoader;
}
