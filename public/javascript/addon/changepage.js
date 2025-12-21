(() => {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let overlay = null;
    let tiles = [];
    let running = false;
    let maxEnd = 0;
    let rafResize = 0;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    const injectStyles = () => {
        if (document.getElementById('page-exit-styles')) return;

        const style = document.createElement('style');
        style.id = 'page-exit-styles';
        style.textContent = `
#pageExitOverlay{
    position:fixed;
    inset:0;
    z-index:999999;
    pointer-events:none;
    background:transparent;
    opacity:0;
    will-change:opacity;
    contain:layout paint size;
}
#pageExitOverlay.is-active{ pointer-events:auto; }
#pageExitOverlay .tile{
    position:absolute;
    background:#303030;
    transform:scale(0) translateZ(0);
    opacity:0;
    border-radius:999px;
    will-change:transform,opacity,border-radius;
    backface-visibility:hidden;
    transition:
        transform var(--dur,560ms) cubic-bezier(.2,.9,.2,1) var(--delay,0ms),
        border-radius var(--dur,560ms) cubic-bezier(.2,.9,.2,1) var(--delay,0ms),
        opacity var(--dur,560ms) ease var(--delay,0ms);
}
#pageExitOverlay.play .tile{
    transform:scale(1) translateZ(0);
    opacity:1;
    border-radius:0px;
}
@media (prefers-reduced-motion: reduce){
    #pageExitOverlay .tile{ transition:none !important; }
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
        const maxTiles = w < 520 ? 160 : 220;
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
        const waveDelay = 420;
        const dur = 560;
        const jitterMax = 45;

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
        overlay.id = 'pageExitOverlay';
        document.body.appendChild(overlay);

        buildTiles();
    };

    const playCover = (done) => {
        if (running) return;
        running = true;

        ensureOverlay();
        if (!overlay || tiles.length === 0) {
            running = false;
            done?.();
            return;
        }

        overlay.classList.remove('play');
        overlay.classList.add('is-active');
        overlay.style.opacity = '1';

        if (prefersReduced) {
            done?.();
            return;
        }

        requestAnimationFrame(() => {
            if (!overlay) return;
            overlay.classList.add('play');
            setTimeout(() => done?.(), maxEnd + 30);
        });
    };

    const isSameOrigin = (url) => {
        try {
            const u = new URL(url, location.href);
            return u.origin === location.origin;
        } catch {
            return false;
        }
    };

    const shouldHandleLink = (a, e) => {
        if (!a || !a.href) return false;
        if (a.hasAttribute('download')) return false;
        if (a.target && a.target !== '_self') return false;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;

        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#')) return false;
        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;

        if (!isSameOrigin(a.href)) return false;

        const u = new URL(a.href, location.href);
        const samePath = u.pathname === location.pathname && u.search === location.search;
        if (samePath && u.hash !== location.hash) return false;

        return true;
    };

    const shouldHandleForm = (form) => {
        if (!form || !(form instanceof HTMLFormElement)) return false;
        if (form.hasAttribute('data-no-transition')) return false;

        const target = (form.getAttribute('target') || '').trim();
        if (target && target !== '_self') return false;

        const actionAttr = (form.getAttribute('action') || '').trim();
        const actionUrl = actionAttr ? new URL(actionAttr, location.href) : new URL(location.href);
        if (!isSameOrigin(actionUrl.href)) return false;

        return true;
    };

    const navigateWithCover = (url) => {
        playCover(() => {
            location.href = url;
        });
    };

    const submitWithCover = (form) => {
        playCover(() => {
            HTMLFormElement.prototype.submit.call(form);
        });
    };

    const onClick = (e) => {
        if (e.defaultPrevented) return;
        if (e.button !== 0) return;

        const a = e.target?.closest?.('a');
        if (!shouldHandleLink(a, e)) return;

        e.preventDefault();
        navigateWithCover(a.href);
    };

    const onSubmit = (e) => {
        const form = e.target;
        if (!shouldHandleForm(form)) return;
        if (e.defaultPrevented) return;

        e.preventDefault();
        submitWithCover(form);
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

    const boot = () => {
        if (document.body) ensureOverlay();
        else document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });

        document.addEventListener('click', onClick, true);
        document.addEventListener('submit', onSubmit, true);
        window.addEventListener('resize', onResize, { passive: true });

        window.PageTransition = {
            go(url) {
                if (!url) return;
                navigateWithCover(url);
            }
        };
    };

    boot();
})();