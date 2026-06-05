/**
 * AppNav — sliding pill indicator + prefetch for main header navigation.
 */
(function initAppNav() {
    const NAV_SELECTOR = '.segmented-control--nav[data-app-nav]';

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

    function moveIndicator(indicator, metrics) {
        indicator.style.width = `${metrics.w}px`;
        indicator.style.height = `${metrics.h}px`;
        indicator.style.transform = `translate3d(${metrics.x}px, ${metrics.y}px, 0)`;
    }

    function setHighlightedItem(items, item) {
        items.forEach(el => {
            el.classList.toggle('segmented-control__item--highlighted', el === item);
        });
    }

    function getActiveItem(items) {
        return items.find(item => item.classList.contains('segmented-control__item--active')) || items[0];
    }

    function bindNav(nav) {
        const indicator = nav.querySelector('.segmented-control__indicator');
        const items = [...nav.querySelectorAll('.segmented-control__item')];
        if (!indicator || !items.length) return;

        const activeItem = getActiveItem(items);
        let hoveredItem = null;

        const syncIndicator = () => {
            const target = hoveredItem || activeItem;
            moveIndicator(indicator, measureItem(nav, target));
            setHighlightedItem(items, target);
            nav.classList.add('segmented-control--nav-ready');
        };

        syncIndicator();

        items.forEach(item => {
            item.addEventListener('pointerenter', () => {
                hoveredItem = item;
                syncIndicator();
                if (item.href && !item.classList.contains('segmented-control__item--active')) {
                    warmupPage(item.href);
                }
            });

            item.addEventListener('pointerdown', () => {
                if (item.classList.contains('segmented-control__item--active')) return;
                item.classList.add('segmented-control__item--pending');
                document.documentElement.classList.add('app-nav-pending');
            });
        });

        nav.addEventListener('pointerleave', () => {
            hoveredItem = null;
            syncIndicator();
        });

        nav.addEventListener('focusin', (event) => {
            const item = event.target.closest('.segmented-control__item');
            if (!item || !nav.contains(item)) return;
            hoveredItem = item;
            syncIndicator();
            if (item.href && !item.classList.contains('segmented-control__item--active')) {
                warmupPage(item.href);
            }
        });

        nav.addEventListener('focusout', (event) => {
            if (nav.contains(event.relatedTarget)) return;
            hoveredItem = null;
            syncIndicator();
        });

        window.addEventListener('resize', syncIndicator);

        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(syncIndicator);
            ro.observe(nav);
            items.forEach(item => ro.observe(item));
        }

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(syncIndicator);
        }

        // Warm the other two pages shortly after idle — helps first click without hover.
        const otherPages = items
            .filter(item => !item.classList.contains('segmented-control__item--active'))
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
