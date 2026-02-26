/**
 * AnalysisDataLoader Component
 * Provides UI to load session data from database (primary) or localStorage (fallback).
 */
class AnalysisDataLoader {
    constructor(options = {}) {
        this.containerId = options.containerId || 'dataLoader';
        this.container = document.getElementById(this.containerId);
        this.onSessionsLoaded = options.onSessionsLoaded || null;
        this.sessions = [];
        this.isLoading = false;

        if (!this.container) {
            console.error(`AnalysisDataLoader: Container #${this.containerId} not found`);
            return;
        }

        this.boundHandlers = {};
        this.render();
    }

    render() {
        this.container.classList.add('analysis-data-loader');

        const header = document.createElement('div');
        header.className = 'analysis-data-loader__header';
        header.textContent = 'DATA SOURCE';

        const actions = document.createElement('div');
        actions.className = 'analysis-data-loader__actions';

        // Load from database button (primary)
        const dbBtn = document.createElement('button');
        dbBtn.className = 'analysis-data-loader__button';
        dbBtn.textContent = 'LOAD DATABASE';
        this.boundHandlers.dbClick = () => this.loadFromDatabase();
        dbBtn.addEventListener('click', this.boundHandlers.dbClick);

        // Load from localStorage button (fallback)
        const localBtn = document.createElement('button');
        localBtn.className = 'analysis-data-loader__button analysis-data-loader__button--secondary';
        localBtn.textContent = 'LOAD FROM BROWSER';

        this.boundHandlers.localClick = () => this.loadFromLocalStorage();
        localBtn.addEventListener('click', this.boundHandlers.localClick);

        actions.appendChild(dbBtn);
        actions.appendChild(localBtn);

        // Status display
        const status = document.createElement('div');
        status.className = 'analysis-data-loader__status';
        this.statusElement = status;

        this.container.innerHTML = '';
        this.container.appendChild(header);
        this.container.appendChild(actions);
        this.container.appendChild(status);

        this.dbButton = dbBtn;
        this.localButton = localBtn;
        this.updateStatus();
    }

    async loadFromDatabase() {
        this.setLoading(true, 'Loading sessions from database...');

        try {
            const response = await fetch('/api/analysis/sessions');
            if (!response.ok) {
                throw new Error(`Request failed (${response.status})`);
            }

            const sessions = await response.json();
            if (!Array.isArray(sessions)) {
                throw new Error('Invalid response payload');
            }

            if (sessions.length === 0) {
                this.sessions = [];
                this.statusElement.textContent = 'No sessions found in database.';
                this.statusElement.classList.remove('analysis-data-loader__status--error');
                this.notifySessionsLoaded();
                return;
            }

            this.setSessions(sessions);
        } catch (err) {
            console.error('AnalysisDataLoader: Error loading database sessions', err);
            this.statusElement.textContent = 'Error loading from database.';
            this.statusElement.classList.add('analysis-data-loader__status--error');
        } finally {
            this.setLoading(false);
        }
    }

    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('sessions');
            if (!stored) {
                this.statusElement.textContent = 'No sessions found in browser storage.';
                this.statusElement.classList.remove('analysis-data-loader__status--error');
                return;
            }
            const sessions = JSON.parse(stored);
            if (Array.isArray(sessions) && sessions.length > 0) {
                this.setSessions(sessions);
            } else {
                this.statusElement.textContent = 'No sessions found in browser storage.';
            }
        } catch (err) {
            console.error('AnalysisDataLoader: Error reading localStorage', err);
            this.statusElement.textContent = 'Error reading browser storage.';
            this.statusElement.classList.add('analysis-data-loader__status--error');
        }
    }

    setSessions(newSessions) {
        this.sessions = Array.isArray(newSessions) ? [...newSessions] : [];
        this.statusElement.classList.remove('analysis-data-loader__status--error');
        this.updateStatus();
        this.notifySessionsLoaded();
    }

    notifySessionsLoaded() {
        if (this.onSessionsLoaded) {
            this.onSessionsLoaded(this.sessions);
        }
    }

    setLoading(isLoading, statusMessage = '') {
        this.isLoading = isLoading;
        if (this.dbButton) this.dbButton.disabled = isLoading;
        if (this.localButton) this.localButton.disabled = isLoading;

        if (isLoading && this.statusElement) {
            this.statusElement.classList.remove('analysis-data-loader__status--error');
            this.statusElement.textContent = statusMessage;
        }
    }

    updateStatus() {
        if (this.isLoading) return;

        if (this.sessions.length === 0) {
            this.statusElement.textContent = '';
            return;
        }

        const trialCount = this.sessions.reduce((sum, s) => {
            return sum + (s.trials ? s.trials.filter(t => t.status === 'completed').length : 0);
        }, 0);

        const sessionText = this.sessions.length === 1 ? 'session' : 'sessions';
        const trialText = trialCount === 1 ? 'trial' : 'trials';
        this.statusElement.textContent = `${this.sessions.length} ${sessionText} loaded (${trialCount} ${trialText})`;
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('analysis-data-loader');
        }
        this.boundHandlers = {};
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisDataLoader;
}
