/**
 * Session-scoped cache for data shared across Explore / Test / Analyze navigations.
 * Makes repeat page loads feel instant while a background refresh keeps data fresh.
 */
(function initDataCache() {
    const PREFIX = 'sail-cache:';
    const DEFAULT_TTL_MS = 5 * 60 * 1000;

    function readEntry(key) {
        try {
            const raw = sessionStorage.getItem(PREFIX + key);
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (!entry || typeof entry.storedAt !== 'number') return null;
            if (Date.now() - entry.storedAt > entry.ttlMs) {
                sessionStorage.removeItem(PREFIX + key);
                return null;
            }
            return entry.data;
        } catch {
            return null;
        }
    }

    function writeEntry(key, data, ttlMs) {
        try {
            sessionStorage.setItem(PREFIX + key, JSON.stringify({
                storedAt: Date.now(),
                ttlMs: ttlMs || DEFAULT_TTL_MS,
                data,
            }));
        } catch {
            /* quota exceeded — ignore */
        }
    }

    async function fetchJson(key, url, options = {}) {
        const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
        const cached = readEntry(key);
        if (cached !== null && !options.force) {
            return cached;
        }

        const response = await fetch(url, options.init);
        if (!response.ok) {
            if (cached !== null) return cached;
            throw new Error(`Request failed (${response.status})`);
        }

        const data = await response.json();
        writeEntry(key, data, ttlMs);
        return data;
    }

    window.AppDataCache = {
        get: readEntry,
        set: writeEntry,
        fetchJson,
    };
})();
