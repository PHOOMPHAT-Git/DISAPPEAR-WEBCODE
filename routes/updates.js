const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const updates = [
        // {
        //     version: 'v1.0.0',
        //     date: '2026-01-01',
        //     title: 'Initial Release',
        //     notes: [
        //         'Public website launch',
        //         'Login + Rating system',
        //         'UI / Neumorphism theme',
        //     ]
        // }
    ];

    res.render('updates', {
        title: 'Disappear',
        updates
    });
});

module.exports = router;