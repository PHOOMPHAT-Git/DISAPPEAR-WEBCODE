const express = require('express');
const router = express.Router();
const https = require('https');
const User = require('../models/user.js');

const robloxUsernameToId = (username) => {
    const body = JSON.stringify({ usernames: [String(username)], excludeBannedUsers: false });

    return new Promise((resolve) => {
        const req = https.request(
            {
                hostname: 'users.roblox.com',
                path: '/v1/usernames/users',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            },
            (res) => {
                let raw = '';
                res.on('data', (chunk) => (raw += chunk));
                res.on('end', () => {
                    try {
                        const json = JSON.parse(raw);
                        const id = json?.data?.[0]?.id;
                        resolve(id ? String(id) : null);
                    } catch (e) {
                        resolve(null);
                    }
                });
            }
        );

        req.on('error', () => resolve(null));
        req.write(body);
        req.end();
    });
};

router.get('/', (req, res) => {
    res.render('login', {
        title: 'Login',
        error: '',
        showDiscord: false,
        discordUrl: res.locals?.config?.discord || '',
        robloxusername: '',
        token: ''
    });
});

router.post('/', async (req, res, next) => {
    try {
        const robloxusername = (req.body.robloxusername || '').trim();
        const token = (req.body.token || '').trim().toUpperCase();

        if (!robloxusername || !token) {
            res.clearCookie('rbx_username');
            res.clearCookie('rbx_userid');
            res.clearCookie('rbx_token');
            return res.render('login', {
                title: 'Login',
                error: 'Please fill in all fields.',
                showDiscord: false,
                discordUrl: res.locals?.config?.discord || '',
                robloxusername,
                token
            });
        }

        if (token.length !== 14) {
            res.clearCookie('rbx_username');
            res.clearCookie('rbx_userid');
            res.clearCookie('rbx_token');
            return res.render('login', {
                title: 'Login',
                error: 'Token must be 14 characters.',
                showDiscord: false,
                discordUrl: res.locals?.config?.discord || '',
                robloxusername,
                token
            });
        }

        const roblox_user_id = await robloxUsernameToId(robloxusername);

        if (!roblox_user_id) {
            res.clearCookie('rbx_username');
            res.clearCookie('rbx_userid');
            res.clearCookie('rbx_token');
            return res.render('login', {
                title: 'Login',
                error: 'Roblox username not found.',
                showDiscord: true,
                discordUrl: res.locals?.config?.discord || '',
                robloxusername,
                token
            });
        }

        const found = await User.findOne({ roblox_user_id, token }).lean();

        if (found) {
            res.cookie('rbx_username', robloxusername, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30 });
            res.cookie('rbx_userid', roblox_user_id, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30 });
            res.cookie('rbx_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30 });
            return res.redirect('/');
        }

        res.clearCookie('rbx_username');
        res.clearCookie('rbx_userid');
        res.clearCookie('rbx_token');
        return res.render('login', {
            title: 'Login',
            error: 'User not found in database.',
            showDiscord: true,
            discordUrl: res.locals?.config?.discord || '',
            robloxusername,
            token
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;