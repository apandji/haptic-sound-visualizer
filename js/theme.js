/**
 * SailTheme — light/dark mode with system default and localStorage persistence.
 */
(function initSailTheme() {
    const STORAGE_KEY = 'sail-theme';

    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function getStoredPreference() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'light' || stored === 'dark' ? stored : null;
    }

    function resolveTheme(preference) {
        if (preference === 'light' || preference === 'dark') return preference;
        return getSystemTheme();
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
            const isDark = theme === 'dark';
            btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
            btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
            btn.title = isDark ? 'Light mode' : 'Dark mode';
        });
    }

    function notifyThemeChange(theme) {
        window.dispatchEvent(new CustomEvent('sail-theme-change', {
            detail: {
                theme,
                preference: getStoredPreference(),
            },
        }));
    }

    function getTheme() {
        return resolveTheme(getStoredPreference());
    }

    function setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') return;
        localStorage.setItem(STORAGE_KEY, theme);
        applyTheme(theme);
        notifyThemeChange(theme);
    }

    function toggleTheme() {
        setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    }

    function mountToggle(container) {
        if (!container || container.querySelector('[data-theme-toggle]')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-btn theme-toggle';
        btn.setAttribute('data-theme-toggle', '');
        btn.innerHTML = `
            <svg class="theme-toggle__icon theme-toggle__icon--sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
            <svg class="theme-toggle__icon theme-toggle__icon--moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
        `;
        btn.addEventListener('click', toggleTheme);
        container.appendChild(btn);
        applyTheme(getTheme());
    }

    function mountAllToggles() {
        document.querySelectorAll('[data-theme-toggle-mount]').forEach(mountToggle);
    }

    applyTheme(getTheme());

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!getStoredPreference()) {
            const theme = getSystemTheme();
            applyTheme(theme);
            notifyThemeChange(theme);
        }
    });

    window.SailTheme = {
        getTheme,
        getStoredPreference,
        setTheme,
        toggleTheme,
        mountToggle,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountAllToggles);
    } else {
        mountAllToggles();
    }
})();
