/**
 * AnalysisDataLoader Component
 * Provides UI to import session data from JSON files or localStorage.
 */
class AnalysisDataLoader {
    constructor(options = {}) {
        this.containerId = options.containerId || 'dataLoader';
        this.container = document.getElementById(this.containerId);
        this.onSessionsLoaded = options.onSessionsLoaded || null;
        this.sessions = [];

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

        // Import JSON button
        const importBtn = document.createElement('button');
        importBtn.className = 'analysis-data-loader__button';
        importBtn.textContent = 'IMPORT JSON';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        this.boundHandlers.importClick = () => fileInput.click();
        this.boundHandlers.fileChange = (e) => this.handleFileImport(e);
        importBtn.addEventListener('click', this.boundHandlers.importClick);
        fileInput.addEventListener('change', this.boundHandlers.fileChange);

        // Load from localStorage button
        const localBtn = document.createElement('button');
        localBtn.className = 'analysis-data-loader__button analysis-data-loader__button--secondary';
        localBtn.textContent = 'LOAD FROM BROWSER';

        this.boundHandlers.localClick = () => this.loadFromLocalStorage();
        localBtn.addEventListener('click', this.boundHandlers.localClick);

        actions.appendChild(importBtn);
        actions.appendChild(fileInput);
        actions.appendChild(localBtn);

        // Status display
        const status = document.createElement('div');
        status.className = 'analysis-data-loader__status';
        this.statusElement = status;

        this.container.innerHTML = '';
        this.container.appendChild(header);
        this.container.appendChild(actions);
        this.container.appendChild(status);

        this.fileInput = fileInput;
        this.updateStatus();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const sessions = Array.isArray(data) ? data : [data];
                this.mergeSessions(sessions);
            } catch (err) {
                console.error('AnalysisDataLoader: Invalid JSON file', err);
                this.statusElement.textContent = 'Error: Invalid JSON file';
                this.statusElement.classList.add('analysis-data-loader__status--error');
            }
        };
        reader.readAsText(file);

        // Reset input so same file can be re-imported
        this.fileInput.value = '';
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
                this.mergeSessions(sessions);
            } else {
                this.statusElement.textContent = 'No sessions found in browser storage.';
            }
        } catch (err) {
            console.error('AnalysisDataLoader: Error reading localStorage', err);
            this.statusElement.textContent = 'Error reading browser storage.';
            this.statusElement.classList.add('analysis-data-loader__status--error');
        }
    }

    mergeSessions(newSessions) {
        // Merge by sessionId to avoid duplicates
        const idSet = new Set(this.sessions.map(s => s.sessionId));
        let added = 0;
        for (const session of newSessions) {
            if (!idSet.has(session.sessionId)) {
                this.sessions.push(session);
                idSet.add(session.sessionId);
                added++;
            }
        }

        this.statusElement.classList.remove('analysis-data-loader__status--error');
        this.updateStatus();

        if (this.onSessionsLoaded) {
            this.onSessionsLoaded(this.sessions);
        }
    }

    updateStatus() {
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
