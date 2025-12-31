const express = require('express');
const router = express.Router();
const https = require('https');
const User = require('../models/user.js');
const Rating = require('../models/rating.js');

const httpsJson = (options) => {
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
        req.end();
    });
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
    const avatar = id
        ? `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(id)}&width=150&height=150&format=png`
        : '';
    return {
        ...r,
        roblox_username: username || (id ? `User ${id}` : 'Unknown'),
        roblox_avatar: avatar
    };
};

router.get('/', async (req, res, next) => {
    try {
        const data = await User.find().lean();
        const latestRatingsRaw = await Rating.find().sort({ updated_at: -1, _id: -1 }).limit(9).lean();

        const agg = await Rating.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]);
        const avg = agg?.[0]?.avg;
        const avgRating10 = Number.isFinite(avg) ? Math.round(avg * 10) / 10 : 0;

        const latestRatings = await Promise.all(latestRatingsRaw.map(enrichRating));

        res.render('index', {
            title: 'Disappear',
            data,
            latestRatings,
            avgRating10
        });
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const {
            roblox_user_id,
            discord_user_id,
            user_number,
            ticket,
            warned,
            banned
        } = req.body;

        const newUser = new User({
            roblox_user_id: roblox_user_id ?? '',
            discord_user_id: discord_user_id ?? '',
            user_number: user_number ?? '',
            ticket: ticket === undefined ? 0 : Number(ticket),
            warned: warned === undefined ? 0 : Number(warned),
            banned: banned === undefined ? 0 : Number(banned),
            updated_at: new Date()
        });

        const savedUser = await newUser.save();
        res.status(201).json({ user: savedUser });
    } catch (err) {
        next(err);
    }
});

module.exports = router;