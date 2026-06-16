/**
 * AppUI — shared loading, empty, error, banner, and tab keyboard helpers.
 */
(function initAppUI() {
    const BANNER_ID = 'appBanner';
    const TOAST_STACK_ID = 'appToastStack';
    const TOAST_ICONS = {
        success: '✓',
        error: '!',
        warning: '⚠',
        info: 'i',
    };

    const WAVE_ICON = `<svg width="48" height="36" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
        <rect x="8" y="18" width="4" height="12" rx="2" fill="currentColor" opacity="0.4"/>
        <rect x="16" y="12" width="4" height="24" rx="2" fill="currentColor" opacity="0.6"/>
        <rect x="24" y="6" width="4" height="36" rx="2" fill="currentColor"/>
        <rect x="32" y="14" width="4" height="20" rx="2" fill="currentColor" opacity="0.8"/>
        <rect x="40" y="10" width="4" height="28" rx="2" fill="currentColor" opacity="0.7"/>
        <rect x="48" y="16" width="4" height="16" rx="2" fill="currentColor" opacity="0.5"/>
        <rect x="56" y="20" width="4" height="8" rx="2" fill="currentColor" opacity="0.4"/>
    </svg>`;

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function loadingHtml(message = 'Loading…') {
        return `
            <div class="app-loading app-loading--compact" role="status">
                <div class="loading-spinner" aria-hidden="true"></div>
                <p class="app-loading__text">${escapeHtml(message)}</p>
            </div>
        `;
    }

    function emptyHtml({ title = 'Nothing here yet', hint = '', icon = true } = {}) {
        const hintHtml = hint
            ? `<p class="app-empty__hint">${escapeHtml(hint)}</p>`
            : '';
        const iconHtml = icon
            ? `<span class="app-empty__icon">${WAVE_ICON}</span>`
            : '';
        return `
            <div class="app-empty" role="status">
                ${iconHtml}
                <p class="app-empty__title">${escapeHtml(title)}</p>
                ${hintHtml}
            </div>
        `;
    }

    function errorHtml({ title = 'Something went wrong', hint = '', retryLabel = 'Try again' } = {}) {
        const hintHtml = hint
            ? `<p class="app-inline-error__hint">${escapeHtml(hint)}</p>`
            : '';
        return `
            <div class="app-inline-error" role="alert">
                <p class="app-inline-error__title">${escapeHtml(title)}</p>
                ${hintHtml}
                <button type="button" class="btn btn--secondary btn--sm app-inline-error__retry">${escapeHtml(retryLabel)}</button>
            </div>
        `;
    }

    function renderLoading(container, message = 'Loading…', options = {}) {
        if (!container) return;
        container.innerHTML = loadingHtml(message);
        container.setAttribute('aria-busy', 'true');
        if (options.live !== false) {
            container.setAttribute('aria-live', 'polite');
        }
    }

    function clearBusy(container) {
        if (!container) return;
        container.removeAttribute('aria-busy');
    }

    function renderEmpty(container, options = {}) {
        if (!container) return;
        container.innerHTML = emptyHtml(options);
        clearBusy(container);
    }

    function renderError(container, options = {}) {
        if (!container) return;
        container.innerHTML = errorHtml(options);
        clearBusy(container);

        const retryBtn = container.querySelector('.app-inline-error__retry');
        if (retryBtn && typeof options.onRetry === 'function') {
            retryBtn.addEventListener('click', options.onRetry);
        }
    }

    function ensureBanner() {
        let banner = document.getElementById(BANNER_ID);
        if (banner) return banner;

        banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.className = 'app-banner';
        banner.setAttribute('role', 'alert');
        banner.hidden = true;

        const header = document.querySelector('.app-header');
        if (header && header.parentNode) {
            header.insertAdjacentElement('afterend', banner);
        } else {
            document.body.prepend(banner);
        }
        return banner;
    }

    function showBanner(options = {}) {
        const banner = ensureBanner();
        const type = options.type === 'error' ? 'error' : 'info';
        const message = options.message || '';
        const actionLabel = options.actionLabel;
        const onAction = options.onAction;

        banner.className = `app-banner app-banner--${type}`;
        banner.innerHTML = `
            <span class="app-banner__message">${escapeHtml(message)}</span>
            ${actionLabel ? `<button type="button" class="app-banner__action">${escapeHtml(actionLabel)}</button>` : ''}
            <button type="button" class="app-banner__dismiss" aria-label="Dismiss">×</button>
        `;
        banner.hidden = false;

        banner.querySelector('.app-banner__dismiss')?.addEventListener('click', hideBanner);

        const actionBtn = banner.querySelector('.app-banner__action');
        if (actionBtn && typeof onAction === 'function') {
            actionBtn.addEventListener('click', () => {
                onAction();
                hideBanner();
            });
        }
    }

    function hideBanner() {
        const banner = document.getElementById(BANNER_ID);
        if (banner) banner.hidden = true;
    }

    function ensureToastStack() {
        let stack = document.getElementById(TOAST_STACK_ID);
        if (stack) return stack;

        stack = document.createElement('div');
        stack.id = TOAST_STACK_ID;
        stack.className = 'toast-stack';
        stack.setAttribute('aria-live', 'polite');
        stack.setAttribute('aria-relevant', 'additions');
        document.body.appendChild(stack);
        return stack;
    }

    function dismissToast(toast) {
        if (!toast?.parentElement) return;

        toast.classList.add('toast--leaving');
        const remove = () => {
            if (toast.parentElement) toast.remove();
        };
        toast.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 350);
    }

    function showToast(options = {}) {
        const type = ['success', 'error', 'warning', 'info'].includes(options.type)
            ? options.type
            : 'info';
        const title = options.title || '';
        const message = options.message || '';
        const duration = options.duration !== undefined ? options.duration : 5000;
        const id = options.id;

        if (id) {
            document.getElementById(id)?.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.setAttribute('role', 'status');
        if (id) toast.id = id;

        const bodyParts = [];
        if (title) bodyParts.push(`<div class="toast__title">${escapeHtml(title)}</div>`);
        if (message) bodyParts.push(`<div class="toast__message">${escapeHtml(message)}</div>`);

        toast.innerHTML = `
            <div class="toast__icon" aria-hidden="true">${TOAST_ICONS[type]}</div>
            <div class="toast__body">${bodyParts.join('')}</div>
            <button type="button" class="toast__close" aria-label="Dismiss">×</button>
        `;

        toast.querySelector('.toast__close')?.addEventListener('click', () => dismissToast(toast));

        ensureToastStack().appendChild(toast);

        if (duration > 0) {
            setTimeout(() => dismissToast(toast), duration);
        }

        return toast;
    }

    function bindSegmentedTabs(tablist, options = {}) {
        if (!tablist) return;

        const tabs = [...tablist.querySelectorAll('[role="tab"]')];
        if (tabs.length < 2) return;

        const getValue = options.getValue || ((tab) => tab.dataset.view || tab.dataset.analyzeTab || tab.textContent.trim());
        const onSelect = options.onSelect;

        tabs.forEach((tab, index) => {
            if (!tab.id) {
                tab.id = `${tablist.id || 'tablist'}-tab-${index}`;
            }
            tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;

            tab.addEventListener('keydown', (event) => {
                let nextIndex = index;

                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    nextIndex = (index + 1) % tabs.length;
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    nextIndex = (index - 1 + tabs.length) % tabs.length;
                } else if (event.key === 'Home') {
                    event.preventDefault();
                    nextIndex = 0;
                } else if (event.key === 'End') {
                    event.preventDefault();
                    nextIndex = tabs.length - 1;
                } else {
                    return;
                }

                tabs[nextIndex].focus();
                if (onSelect) onSelect(getValue(tabs[nextIndex]), tabs[nextIndex]);
            });
        });

        return {
            syncTabIndex(activeTab) {
                tabs.forEach(tab => {
                    const isActive = tab === activeTab;
                    tab.tabIndex = isActive ? 0 : -1;
                });
            },
        };
    }

    window.AppUI = {
        escapeHtml,
        loadingHtml,
        emptyHtml,
        errorHtml,
        renderLoading,
        renderEmpty,
        renderError,
        clearBusy,
        showBanner,
        hideBanner,
        showToast,
        dismissToast,
        bindSegmentedTabs,
    };
})();
