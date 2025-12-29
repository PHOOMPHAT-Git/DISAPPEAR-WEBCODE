const express = require('express');
const router = express.Router();
const https = require('https');
const User = require('../models/user.js');
const Rating = require('../models/rating.js');

const httpsJson = (options, body) => {
    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(raw));
                } catch {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        if (body) req.write(body);
        req.end();
    });
};

const robloxUsernameToIdAndName = async (username) => {
    const body = JSON.stringify({ usernames: [String(username)], excludeBannedUsers: false });
    const json = await httpsJson(
        {
            hostname: 'users.roblox.com',
            path: '/v1/usernames/users',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        },
        body
    );
    const item = json?.data?.[0];
    if (!item?.id) return null;
    return { id: String(item.id), name: item.name ? String(item.name) : String(username) };
};

const robloxIdToUsername = async (userId) => {
    const json = await httpsJson({
        hostname: 'users.roblox.com',
        path: `/v1/users/${encodeURIComponent(String(userId))}`,
        method: 'GET'
    });
    const name = json?.name;
    return name ? String(name) : null;
};

const enrichRating = async (r) => {
    const id = r?.roblox_user_id ? String(r.roblox_user_id) : '';
    const username = id ? await robloxIdToUsername(id) : null;
    return {
        ...r,
        roblox_username: username || (id ? `User ${id}` : 'Unknown'),
        user_number: r?.user_number ? String(r.user_number) : ''
    };
};

const getAvgRating10 = async () => {
    const agg = await Rating.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]);
    const avg = agg?.[0]?.avg;
    if (!Number.isFinite(avg)) return 0;
    return Math.round(avg * 10) / 10;
};

const getRatingByQuery = async (q) => {
    const raw = String(q || '').trim();
    if (!raw) return { kind: 'empty' };

    if (/^\d+$/.test(raw)) {
        const n = Number(raw);
        const ratingRaw = await Rating.findOne({
            $or: [
                { user_number: raw },
                { user_number: n },
                { roblox_user_id: raw },
                { roblox_user_id: n }
            ]
        }).lean();

        if (!ratingRaw) return { kind: 'not_found', query: raw };

        const id = ratingRaw?.roblox_user_id ? String(ratingRaw.roblox_user_id) : '';
        const name = id ? await robloxIdToUsername(id) : null;

        return {
            kind: 'ok',
            query: raw,
            info: id ? { id, name: name || (id ? `User ${id}` : 'Unknown') } : null,
            ratingRaw
        };
    }

    const info = await robloxUsernameToIdAndName(raw);
    if (!info) return { kind: 'roblox_user_not_found', query: raw };

    const ratingRaw = await Rating.findOne({ roblox_user_id: info.id }).lean();
    if (!ratingRaw) return { kind: 'rating_not_found', query: info.name, info };

    return { kind: 'ok', query: info.name, info, ratingRaw };
};

router.get('/latest', async (req, res, next) => {
    try {
        const ratingsRaw = await Rating.find().sort({ updated_at: -1, _id: -1 }).limit(9).lean();
        const ratings = await Promise.all(ratingsRaw.map(enrichRating));
        const count = await Rating.countDocuments();
        const avgRating10 = await getAvgRating10();
        res.json({ ratings, count, avgRating10 });
    } catch (err) {
        next(err);
    }
});

router.get('/search', async (req, res, next) => {
    try {
        const q = String(req.query.username || '').trim();
        if (!q) return res.status(400).json({ error: 'username_required' });

        const found = await getRatingByQuery(q);

        if (found.kind === 'empty') return res.status(400).json({ error: 'username_required' });
        if (found.kind === 'roblox_user_not_found') return res.status(404).json({ error: 'roblox_user_not_found' });
        if (found.kind === 'rating_not_found' || found.kind === 'not_found')
            return res.status(404).json({ error: 'rating_not_found' });

        const rating = await enrichRating(found.ratingRaw);
        res.json({ rating });
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const roblox_user_id = req.cookies?.rbx_userid ? String(req.cookies.rbx_userid) : '';
        const token = req.cookies?.rbx_token ? String(req.cookies.rbx_token) : '';
        if (!roblox_user_id || !token) return res.status(401).json({ error: 'unauthorized' });

        const foundUser = await User.findOne({ roblox_user_id, token }).lean();
        if (!foundUser) return res.status(403).json({ error: 'invalid_token' });

        const ratingStr = String(req.body.rating ?? '').trim();
        const message = String(req.body.message || '').trim().slice(0, 240);

        const ratingRe = /^(10(\.0)?|[0-9](\.[0-9])?)$/;
        if (!ratingRe.test(ratingStr)) return res.status(400).json({ error: 'invalid_rating' });

        const ratingVal = Math.round(parseFloat(ratingStr) * 10) / 10;
        if (!Number.isFinite(ratingVal) || ratingVal < 0 || ratingVal > 10) return res.status(400).json({ error: 'invalid_rating' });
        if (!message) return res.status(400).json({ error: 'message_required' });

        await Rating.findOneAndUpdate(
            { roblox_user_id },
            {
                $set: {
                    roblox_user_id,
                    discord_user_id: foundUser.discord_user_id || '',
                    user_number: foundUser.user_number || '',
                    rating: ratingVal,
                    message,
                    updated_at: new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const ratingsRaw = await Rating.find().sort({ updated_at: -1, _id: -1 }).limit(9).lean();
        const ratings = await Promise.all(ratingsRaw.map(enrichRating));
        const count = await Rating.countDocuments();
        const avgRating10 = await getAvgRating10();

        res.json({ ok: true, ratings, count, avgRating10 });
    } catch (err) {
        next(err);
    }
});

router.post('/delete', async (req, res, next) => {
    try {
        const roblox_user_id = req.cookies?.rbx_userid ? String(req.cookies.rbx_userid) : '';
        const token = req.cookies?.rbx_token ? String(req.cookies.rbx_token) : '';
        if (!roblox_user_id || !token) return res.status(401).json({ error: 'unauthorized' });

        const foundUser = await User.findOne({ roblox_user_id, token }).lean();
        if (!foundUser) return res.status(403).json({ error: 'invalid_token' });

        const deleted = await Rating.findOneAndDelete({ roblox_user_id }).lean();
        if (!deleted) return res.status(404).json({ error: 'rating_not_found' });

        const ratingsRaw = await Rating.find().sort({ updated_at: -1, _id: -1 }).limit(9).lean();
        const ratings = await Promise.all(ratingsRaw.map(enrichRating));
        const count = await Rating.countDocuments();
        const avgRating10 = await getAvgRating10();

        res.json({ ok: true, deleted: true, ratings, count, avgRating10 });
    } catch (err) {
        next(err);
    }
});

router.get('/', (req, res) => {
    return res.redirect('/');
});

module.exports = router;