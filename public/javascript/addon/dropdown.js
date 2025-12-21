(() => {
    const wraps = Array.from(document.querySelectorAll('[data-auth-menu="wrap"]'));

    const setOpen = (wrap, open) => {
        if (!wrap) return;
        wrap.classList.toggle('is-open', open);
        const btn = wrap.querySelector('[data-auth-menu="btn"]');
        const menu = wrap.querySelector('[data-auth-menu="menu"]');
        if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (menu) menu.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (open) requestAnimationFrame(() => syncWidth(wrap));
    };

    const closeAll = (exceptWrap = null) => {
        wraps.forEach((w) => {
            if (exceptWrap && w === exceptWrap) return;
            setOpen(w, false);
        });
    };

    const measureItemWidth = (el) => {
        const clone = el.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.left = '-99999px';
        clone.style.top = '-99999px';
        clone.style.visibility = 'hidden';
        clone.style.whiteSpace = 'nowrap';
        document.body.appendChild(clone);
        const w = Math.ceil(clone.getBoundingClientRect().width);
        document.body.removeChild(clone);
        return w;
    };

    const syncWidth = (wrap) => {
        const btn = wrap.querySelector('[data-auth-menu="btn"]');
        const menu = wrap.querySelector('[data-auth-menu="menu"]');
        if (!btn || !menu) return;

        wrap.style.minWidth = '';
        const btnW = Math.ceil(btn.getBoundingClientRect().width);

        const items = Array.from(menu.querySelectorAll('.nav__auth-item'));
        let maxItemW = 0;
        for (const it of items) {
            const w = measureItemWidth(it);
            if (w > maxItemW) maxItemW = w;
        }

        const menuStyle = getComputedStyle(menu);
        const padL = parseFloat(menuStyle.paddingLeft) || 0;
        const padR = parseFloat(menuStyle.paddingRight) || 0;

        const needed = Math.max(btnW, maxItemW + padL + padR);
        if (needed > btnW) wrap.style.minWidth = `${needed}px`;
    };

    wraps.forEach((wrap) => {
        const btn = wrap.querySelector('[data-auth-menu="btn"]');
        if (!btn) return;

        syncWidth(wrap);

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = wrap.classList.contains('is-open');
            closeAll(wrap);
            setOpen(wrap, !isOpen);
        });
    });

    document.addEventListener('click', (e) => {
        const inside = e.target.closest('[data-auth-menu="wrap"]');
        if (!inside) closeAll();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAll();
    });

    window.addEventListener('blur', () => closeAll());

    let t = null;
    window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => wraps.forEach(syncWidth), 80);
    });
})();