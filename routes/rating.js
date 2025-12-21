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
        const username = String(req.query.username || '').trim();
        if (!username) return res.status(400).json({ error: 'username_required' });

        const info = await robloxUsernameToIdAndName(username);
        if (!info) return res.status(404).json({ error: 'roblox_user_not_found' });

        const ratingRaw = await Rating.findOne({ roblox_user_id: info.id }).lean();
        if (!ratingRaw) return res.status(404).json({ error: 'rating_not_found', roblox_user_id: info.id });

        const rating = await enrichRating(ratingRaw);
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

router.get('/', async (req, res, next) => {
    try {
        const username = String(req.query.username || '').trim();

        if (!username) {
            return res.render('rating', {
                queryUsername: '',
                rating: null,
                error: ''
            });
        }

        const info = await robloxUsernameToIdAndName(username);
        if (!info) {
            return res.render('rating', {
                queryUsername: username,
                rating: null,
                error: 'roblox_user_not_found'
            });
        }

        const ratingRaw = await Rating.findOne({ roblox_user_id: info.id }).lean();
        if (!ratingRaw) {
            return res.render('rating', {
                queryUsername: info.name,
                rating: null,
                error: 'rating_not_found'
            });
        }

        const out = {
            roblox_user_id: info.id,
            roblox_username: info.name,
            user_number: ratingRaw.user_number ? String(ratingRaw.user_number) : '',
            rating: ratingRaw.rating,
            message: ratingRaw.message || '',
            updated_at: ratingRaw.updated_at
        };

        res.render('rating', {
            queryUsername: info.name,
            rating: out,
            error: ''
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;