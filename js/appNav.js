/**
 * AppNav — prefetch + (for segmented navs) active-tab pill positioning.
 * Works with both the pill nav (.segmented-control--nav) and the quiet
 * text-link nav (.app-nav-links).
 */
(function initAppNav() {
    const NAV_SELECTOR = '[data-app-nav]';
    const ITEM_SELECTOR = '.segmented-control__item, .app-nav-links__item';

    function isActive(item) {
        return item.classList.contains('segmented-control__item--active')
            || item.classList.contains('app-nav-links__item--active');
    }

    const PAGE_WARMUP = {
        'index.html': [
            'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.2/p5.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.2/addons/p5.sound.min.js',
            'pattern_metadata.json',
            '/api/list-audio-files',
        ],
        'test.html': [
            'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.2/p5.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.2/addons/p5.sound.min.js',
            'pattern_metadata.json',
            '/api/list-audio-files',
            '/api/participants',
        ],
        'analyze.html': [
            'https://cdn.plot.ly/plotly-2.35.2.min.js',
            '/api/analysis/sessions',
        ],
    };

    const prefetched = new Set();

    function prefetchUrl(url) {
        if (!url || prefetched.has(url)) return;
        prefetched.add(url);

        if (url.endsWith('.html') || url.endsWith('/')) {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            link.as = 'document';
            document.head.appendChild(link);
            return;
        }

        fetch(url, { credentials: 'same-origin' }).catch(() => {
            prefetched.delete(url);
        });
    }

    function warmupPage(href) {
        const page = href.split('/').pop() || 'index.html';
        prefetchUrl(href);

        const assets = PAGE_WARMUP[page];
        if (assets) {
            assets.forEach(prefetchUrl);
        }
    }

    function measureItem(nav, item) {
        const navRect = nav.getBoundingClientRect();
        const rect = item.getBoundingClientRect();
        return {
            x: rect.left - navRect.left,
            y: rect.top - navRect.top,
            w: rect.width,
            h: rect.height,
        };
    }

    function positionActiveIndicator(nav, indicator, activeItem) {
        const metrics = measureItem(nav, activeItem);
        indicator.style.width = `${metrics.w}px`;
        indicator.style.height = `${metrics.h}px`;
        indicator.style.transform = `translate3d(${metrics.x}px, ${metrics.y}px, 0)`;
    }

    function getActiveItem(items) {
        return items.find(isActive) || items[0];
    }

    function bindNav(nav) {
        const indicator = nav.querySelector('.segmented-control__indicator');
        const items = [...nav.querySelectorAll(ITEM_SELECTOR)];
        if (!items.length) return;

        if (indicator) {
            const activeItem = getActiveItem(items);

            const syncActiveIndicator = () => {
                positionActiveIndicator(nav, indicator, activeItem);
                nav.classList.add('segmented-control--nav-ready');
            };

            syncActiveIndicator();
            window.addEventListener('resize', syncActiveIndicator);

            if (typeof ResizeObserver !== 'undefined') {
                const ro = new ResizeObserver(syncActiveIndicator);
                ro.observe(nav);
                items.forEach(item => ro.observe(item));
            }

            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(syncActiveIndicator);
            }
        }

        items.forEach(item => {
            item.addEventListener('pointerenter', () => {
                if (item.href && !isActive(item)) {
                    warmupPage(item.href);
                }
            });

            item.addEventListener('pointerdown', () => {
                if (isActive(item)) return;
                item.classList.add('segmented-control__item--pending');
                document.documentElement.classList.add('app-nav-pending');
            });
        });

        const otherPages = items
            .filter(item => !isActive(item) && item.href)
            .map(item => item.href);

        if (otherPages.length && 'requestIdleCallback' in window) {
            requestIdleCallback(() => otherPages.forEach(warmupPage), { timeout: 2500 });
        }
    }

    function initAll() {
        document.querySelectorAll(NAV_SELECTOR).forEach(bindNav);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();
