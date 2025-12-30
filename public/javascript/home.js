(() => {
    const listEl = document.getElementById('ratingsList');
    const avgEl = document.getElementById('ratingsAvg');

    let boardMode = 'latest';
    const setBoardMode = (mode) => {
        boardMode = (mode === 'search') ? 'search' : 'latest';
        if (listEl) listEl.dataset.mode = boardMode;
    };


    const refreshBtn = document.getElementById('ratingsRefreshBtn');

    const searchForm = document.getElementById('ratingSearchForm');
    const searchInput = document.getElementById('ratingSearchInput');
    const searchBtn = document.getElementById('ratingSearchBtn');
    const searchResultEl = document.getElementById('ratingSearchResult');

    const deleteBtn = document.getElementById('ratingDeleteBtn');
    const statusEl = document.getElementById('ratingCreateStatus');

    const setCreateStatus = (text) => {
        if (!statusEl) return;
        statusEl.textContent = text || '';
    };

    const clearEl = (el) => {
        if (!el) return;
        while (el.firstChild) el.removeChild(el.firstChild);
    };

    const buildRatingItem = (r) => {
        const item = document.createElement('div');
        item.className = 'neu-card neu-card--inset ratings__item';
        item.dataset.userid = r?.roblox_user_id ? String(r.roblox_user_id) : '';

        const top = document.createElement('div');
        top.className = 'ratings__item-top';

        const user = document.createElement('div');
        user.className = 'ratings__user';

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-user ratings__user-icon';

        const username = document.createElement('span');
        username.className = 'ratings__username';
        username.textContent = r?.roblox_username || (r?.roblox_user_id ? `User ${String(r.roblox_user_id)}` : 'Unknown');

        user.appendChild(icon);
        user.appendChild(username);

        const score = document.createElement('div');
        score.className = 'ratings__score';
        const ratingVal = (typeof r?.rating === 'number') ? r.rating : Number(r?.rating);
        const ratingText = Number.isFinite(ratingVal) ? String((Math.round(ratingVal * 10) / 10)).replace(/\.0$/, '') : '0';
        score.textContent = `${ratingText}/10`;

        top.appendChild(user);
        top.appendChild(score);

        const msg = document.createElement('div');
        msg.className = 'ratings__message';
        msg.textContent = r?.message ? String(r.message) : '';

        const member = document.createElement('div');
        member.className = 'ratings__member';
        member.textContent = r?.user_number ? ` Discord Member : ${String(r.user_number)}` : '';

        const time = document.createElement('div');
        time.className = 'ratings__time';
        try {
            time.textContent = r?.updated_at ? new Date(r.updated_at).toLocaleString() : '';
        } catch {
            time.textContent = '';
        }

        item.appendChild(top);
        item.appendChild(msg);
        item.appendChild(member);
        item.appendChild(time);

        return item;
    };

    const renderRatings = (ratings) => {
        if (!listEl) return;
        clearEl(listEl);

        if (!Array.isArray(ratings) || ratings.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'ratings__empty';
            empty.textContent = 'No ratings yet.';
            listEl.appendChild(empty);
            return;
        }

        for (const r of ratings) {
            listEl.appendChild(buildRatingItem(r));
        }
    };

    const setSearchText = (text) => {
        if (!searchResultEl) return;
        clearEl(searchResultEl);
        if (!text) return;
        const el = document.createElement('div');
        el.className = 'ratings__empty';
        el.textContent = text;
        searchResultEl.appendChild(el);
    };

    const renderSearchResult = (rating, queryText) => {
        if (!listEl) return;

        if (!rating) {
            setBoardMode('search');
            renderRatings([]);
            setSearchText('No result.');
            return;
        }

        setBoardMode('search');
        renderRatings([rating]);

        const q = (queryText ? String(queryText) : '').trim();
        if (q) setSearchText(`Showing result for "${q}"`);
        else setSearchText('Showing search result');
    };

    const refreshLatest = async () => {
        if (!refreshBtn) return;

        setBoardMode('latest');
        setSearchText('');

        refreshBtn.disabled = true;
        const oldLabel = refreshBtn.querySelector('span') ? refreshBtn.querySelector('span').textContent : '';
        if (refreshBtn.querySelector('span')) refreshBtn.querySelector('span').textContent = 'Refreshing...';

        try {
            const res = await fetch('/rating/latest', { method: 'GET' });
            const json = await res.json().catch(() => null);

            if (!res.ok || !json) {
                if (refreshBtn.querySelector('span')) refreshBtn.querySelector('span').textContent = oldLabel || 'Refresh';
                return;
            }

            if (avgEl && typeof json?.avgRating10 !== 'undefined') avgEl.textContent = json.avgRating10;
            if (typeof json?.ratings !== 'undefined') renderRatings(json.ratings);
        } catch {
        } finally {
            refreshBtn.disabled = false;
            if (refreshBtn.querySelector('span')) refreshBtn.querySelector('span').textContent = oldLabel || 'Refresh';
        }
    };

    if (refreshBtn) refreshBtn.addEventListener('click', refreshLatest);

    if (searchForm) {
        const doSearch = async () => {
            const q = searchInput ? String(searchInput.value || '').trim() : '';
            if (!q) {
                setSearchText('Please enter a Roblox username / user id / Discord member.');
                return;
            }

            if (searchBtn) searchBtn.disabled = true;
            setSearchText('Searching...');

            try {
                const res = await fetch(`/rating/search?username=${encodeURIComponent(q)}`, { method: 'GET' });
                const json = await res.json().catch(() => null);

                if (!res.ok) {
                    const err = json?.error || 'search_failed';
                    if (err === 'username_required') setSearchText('Please enter a Roblox username / user id / Discord member.');
                    else if (err === 'roblox_user_not_found') setSearchText('Roblox user not found.');
                    else if (err === 'rating_not_found') setSearchText('Rating not found.');
                    else setSearchText('Search failed.');
                    setBoardMode('search');
                    return;
                }

                if (json?.rating) renderSearchResult(json.rating, q);
                else renderSearchResult(null, q);
            } catch {
                setSearchText('Search failed.');
                setBoardMode('search');
            } finally {
                if (searchBtn) searchBtn.disabled = false;
            }
        };

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            void doSearch();
        });

        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                void doSearch();
            });
        }
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const ok = window.confirm('Delete your rating?');
            if (!ok) return;

            deleteBtn.disabled = true;
            setCreateStatus('Deleting...');

            try {
                const res = await fetch('/rating/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                });

                const json = await res.json().catch(() => null);

                if (!res.ok) {
                    const err = json?.error || 'delete_failed';
                    if (err === 'unauthorized') setCreateStatus('Please login first.');
                    else if (err === 'invalid_token') setCreateStatus('Invalid session. Please login again.');
                    else if (err === 'rating_not_found') setCreateStatus('No rating to delete.');
                    else setCreateStatus('Delete failed.');
                    return;
                }

                if (avgEl && typeof json?.avgRating10 !== 'undefined') avgEl.textContent = json.avgRating10;
                if (typeof json?.ratings !== 'undefined') renderRatings(json.ratings);

                const ratingValue = document.getElementById('ratingValue');
                const ratingMessage = document.getElementById('ratingMessage');
                const countText = document.getElementById('ratingCountText');

                if (ratingValue) ratingValue.value = '';
                if (ratingMessage) ratingMessage.value = '';
                if (countText) countText.textContent = '0/240';

                setCreateStatus('Deleted.');
            } catch {
                setCreateStatus('Delete failed.');
            } finally {
                deleteBtn.disabled = false;
            }
        });
    }
})();