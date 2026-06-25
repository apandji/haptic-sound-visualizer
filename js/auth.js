/**
 * Entra session gate — redirects to login when AUTH_REQUIRED and no session.
 * Hides nav links the user cannot access.
 */
(function initAuth() {
    const mount = document.querySelector('[data-auth-mount]');

    function shortEmail(email) {
        if (!email) return '';
        const at = email.indexOf('@');
        return at > 0 ? email.slice(0, at) : email;
    }

    function renderAuth(user, pages) {
        if (!mount) return;
        const label = document.createElement('span');
        label.className = 'app-auth-chip';
        label.title = user.email || user.name || '';
        label.textContent = shortEmail(user.email) || user.name || 'Signed in';

        const logout = document.createElement('a');
        logout.className = 'app-auth-logout';
        logout.href = '/auth/logout';
        logout.textContent = 'Sign out';

        mount.replaceChildren(label, logout);

        if (pages) {
            document.querySelectorAll('[data-app-nav] a[href="test.html"]').forEach((el) => {
                el.hidden = !pages.test;
            });
            document.querySelectorAll('[data-app-nav] a[href="analyze.html"]').forEach((el) => {
                el.hidden = !pages.analyze;
            });
        }
    }

    fetch('/api/me', { credentials: 'same-origin' })
        .then((res) => res.json().then((body) => ({ res, body })))
        .then(({ res, body }) => {
            if (!body.auth_required) return;
            if (!body.authenticated) {
                const next = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.replace(`/auth/login?next=${next}`);
                return;
            }
            renderAuth(body.user, body.pages);
        })
        .catch(() => {});
})();
