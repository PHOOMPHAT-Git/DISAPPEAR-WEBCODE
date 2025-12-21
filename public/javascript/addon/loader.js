(() => {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let overlay = null;
    let tiles = [];
    let started = false;
    let maxEnd = 0;
    let rafResize = 0;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    const removePreloadCover = () => {
        document.documentElement.classList.remove('preload');
        const s = document.getElementById('preload-cover-style');
        if (s) s.remove();
    };

    const injectStyles = () => {
        if (document.getElementById('page-loader-styles')) return;

        const style = document.createElement('style');
        style.id = 'page-loader-styles';
        style.textContent = `
#pageLoaderOverlay{
    position:fixed;
    inset:0;
    z-index:999999;
    pointer-events:none;
    background:transparent;
    opacity:1;
    will-change:opacity;
    contain:layout paint size;
}
#pageLoaderOverlay .tile{
    position:absolute;
    background:#303030;
    transform:scale(1) translateZ(0);
    opacity:1;
    border-radius:0;
    will-change:transform,opacity,border-radius;
    backface-visibility:hidden;
    transition:
        transform var(--dur,520ms) cubic-bezier(.2,.9,.2,1) var(--delay,0ms),
        border-radius var(--dur,520ms) cubic-bezier(.2,.9,.2,1) var(--delay,0ms),
        opacity var(--dur,520ms) ease var(--delay,0ms);
}
#pageLoaderOverlay.play .tile{
    border-radius:999px;
    transform:scale(0) translateZ(0);
    opacity:0;
}
@media (prefers-reduced-motion: reduce){
    #pageLoaderOverlay .tile{ transition:none !important; }
}
        `.trim();
        document.head.appendChild(style);
    };

    const clearTiles = () => {
        tiles.forEach(t => t.remove());
        tiles = [];
        maxEnd = 0;
    };

    const pickTileSize = (w, h) => {
        const maxTiles = w < 520 ? 140 : 200;
        const areaPerTile = (w * h) / maxTiles;
        const side = Math.sqrt(areaPerTile);
        return clamp(Math.floor(side), 56, 110);
    };

    const buildTiles = () => {
        if (!overlay) return;

        clearTiles();

        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;

        const tile = pickTileSize(w, h);
        const cols = Math.ceil(w / tile);
        const rows = Math.ceil(h / tile);

        const tileW = Math.ceil(w / cols);
        const tileH = Math.ceil(h / rows);

        const cx0 = w / 2;
        const cy0 = h / 2;
        const maxD = Math.hypot(cx0, cy0) || 1;

        const baseDelay = 10;
        const waveDelay = 320;
        const dur = 520;
        const jitterMax = 35;

        const frag = document.createDocumentFragment();
        let localMaxEnd = 0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const d = document.createElement('div');
                d.className = 'tile';

                const x = c * tileW;
                const y = r * tileH;

                const cx = x + tileW / 2;
                const cy = y + tileH / 2;

                const nd = Math.hypot(cx - cx0, cy - cy0) / maxD;
                const delay = baseDelay + nd * waveDelay + Math.random() * jitterMax;

                d.style.left = x + 'px';
                d.style.top = y + 'px';
                d.style.width = (tileW + 1) + 'px';
                d.style.height = (tileH + 1) + 'px';
                d.style.setProperty('--delay', delay + 'ms');
                d.style.setProperty('--dur', dur + 'ms');

                const endAt = delay + dur;
                if (endAt > localMaxEnd) localMaxEnd = endAt;

                frag.appendChild(d);
                tiles.push(d);
            }
        }

        overlay.appendChild(frag);
        maxEnd = localMaxEnd;
    };

    const ensureOverlay = () => {
        if (overlay) return;

        injectStyles();

        overlay = document.createElement('div');
        overlay.id = 'pageLoaderOverlay';
        document.body.appendChild(overlay);

        buildTiles();
    };

    const destroyOverlay = () => {
        if (!overlay) return;

        clearTiles();
        overlay.remove();
        overlay = null;

        const style = document.getElementById('page-loader-styles');
        if (style) style.remove();
    };

    const playReveal = () => {
        if (started) return;
        started = true;

        if (!overlay || tiles.length === 0) {
            removePreloadCover();
            destroyOverlay();
            return;
        }

        if (prefersReduced) {
            removePreloadCover();
            overlay.style.transition = 'opacity 180ms ease';
            overlay.style.opacity = '0';
            setTimeout(destroyOverlay, 200);
            return;
        }

        requestAnimationFrame(() => {
            if (!overlay) return;

            removePreloadCover();

            requestAnimationFrame(() => {
                if (!overlay) return;

                overlay.classList.add('play');

                const fadeAt = Math.max(0, maxEnd - 140);
                overlay.style.transition = `opacity 180ms ease ${fadeAt}ms`;
                overlay.style.opacity = '0';

                setTimeout(destroyOverlay, maxEnd + 220);
            });
        });
    };

    const onResize = () => {
        if (!overlay) return;
        if (rafResize) cancelAnimationFrame(rafResize);
        rafResize = requestAnimationFrame(() => {
            rafResize = 0;
            const wasPlaying = overlay.classList.contains('play');
            overlay.classList.remove('play');
            buildTiles();
            if (wasPlaying) overlay.classList.add('play');
        });
    };

    const startSoon = () => {
        if (!overlay) ensureOverlay();
        setTimeout(playReveal, 40);
    };

    const boot = () => {
        if (!document.documentElement.classList.contains('preload')) {
            document.documentElement.classList.add('preload');
        }

        if (document.body) ensureOverlay();
        else document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });

        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            startSoon();
        } else {
            document.addEventListener('DOMContentLoaded', startSoon, { once: true });
        }

        window.addEventListener('load', () => {
            if (!started) playReveal();
        }, { once: true });

        window.addEventListener('pageshow', (e) => {
            if (e.persisted) {
                removePreloadCover();
                destroyOverlay();
            }
        });

        window.addEventListener('resize', onResize, { passive: true });
    };

    boot();
})();