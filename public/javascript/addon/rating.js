const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const starsHtml = (v) => {
    const n = Math.max(0, Math.min(5, Number(v) || 0));
    let out = '';
    for (let i = 1; i <= 5; i++) out += `<i class="${i <= n ? 'fa-solid fa-star' : 'fa-regular fa-star'}"></i>`;
    return out;
};
const renderRatingItem = (r) => {
    const uname = r.roblox_username || (r.roblox_user_id ? `User ${r.roblox_user_id}` : 'Unknown');
    const msg = r.message || '';
    const time = r.updated_at ? new Date(r.updated_at).toLocaleString() : '';
    return `
        <div class="neu-card neu-card--inset ratings__item" data-userid="${escapeHtml(r.roblox_user_id || '')}">
            <div class="ratings__item-top">
                <div class="ratings__user">
                    <i class="fab fa-roblox"></i>
                    <span class="ratings__username">${escapeHtml(uname)}</span>
                </div>
                <div class="ratings__stars" aria-label="Rating ${Number(r.rating) || 0} out of 5">
                    ${starsHtml(r.rating)}
                </div>
            </div>
            <div class="ratings__message">${escapeHtml(msg)}</div>
            <div class="ratings__time">${escapeHtml(time)}</div>
        </div>
    `;
};
const setStatus = (el, msg) => { if (el) el.textContent = msg || ''; };

const ratingsListEl = document.getElementById('ratingsList');
const ratingsCountEl = document.getElementById('ratingsCount');
const createForm = document.getElementById('ratingCreateForm');
const createStatusEl = document.getElementById('ratingCreateStatus');
const msgEl = document.getElementById('ratingMessage');
const countTextEl = document.getElementById('ratingCountText');
const searchForm = document.getElementById('ratingSearchForm');
const searchInput = document.getElementById('ratingSearchInput');
const searchResultEl = document.getElementById('ratingSearchResult');

const refreshLatestRatings = async () => {
    const res = await fetch('/rating/latest', { headers: { 'Accept': 'application/json' } });
    const json = await res.json();
    const ratings = Array.isArray(json.ratings) ? json.ratings : [];
    if (ratingsListEl) ratingsListEl.innerHTML = ratings.length ? ratings.map(renderRatingItem).join('') : '<div class="ratings__empty">No ratings yet.</div>';
    if (ratingsCountEl) ratingsCountEl.textContent = (json.count ?? 0);
};

if (msgEl && countTextEl) {
    const updateCount = () => { countTextEl.textContent = `${Math.min(240, (msgEl.value || '').length)}/240`; };
    msgEl.addEventListener('input', updateCount);
    updateCount();
}

if (searchForm && searchInput && searchResultEl) {
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setStatus(searchResultEl, '');
        const username = (searchInput.value || '').trim();
        if (!username) return;

        searchResultEl.textContent = 'Searching...';
        try {
            const res = await fetch(`/rating/search?username=${encodeURIComponent(username)}`, { headers: { 'Accept': 'application/json' } });
            const json = await res.json();

            if (!res.ok || !json || !json.rating) {
                searchResultEl.textContent = 'No rating found.';
                return;
            }

            searchResultEl.innerHTML = renderRatingItem(json.rating);
        } catch (err) {
            searchResultEl.textContent = 'Search failed.';
        }
    });
}

if (createForm) {
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setStatus(createStatusEl, '');

        const ratingValue = document.getElementById('ratingValue');
        const rating = ratingValue ? Number(ratingValue.value) : 0;
        const message = (msgEl ? msgEl.value : '').trim();

        if (!message) return setStatus(createStatusEl, 'Please write a comment.');
        setStatus(createStatusEl, 'Posting...');

        try {
            const res = await fetch('/rating', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ rating, message })
            });

            const json = await res.json();

            if (!res.ok || !json.ok) {
                const errMsg = json?.error === 'unauthorized' ? 'Please login first.' :
                               json?.error === 'invalid_token' ? 'Token verification failed. Please login again.' :
                               json?.error === 'invalid_rating' ? 'Invalid rating value.' :
                               json?.error === 'message_required' ? 'Please write a comment.' :
                               'Failed to post rating.';
                return setStatus(createStatusEl, errMsg);
            }

            if (msgEl) msgEl.value = '';
            if (ratingValue) ratingValue.value = '5';
            if (countTextEl) countTextEl.textContent = '0/240';
            setStatus(createStatusEl, 'Posted.');
            await refreshLatestRatings();
        } catch (err) {
            setStatus(createStatusEl, 'Failed to post rating.');
        }
    });
}