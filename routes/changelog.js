const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const changelog = [
        // {
        //     version: 'v1.0.0',
        //     date: '2026-01-02',
        //     sections: [
        //         {
        //             label: 'Added',
        //             items: [
        //                 'Public website launch',
        //                 'Login system',
        //                 'Ratings system'
        //             ]
        //         },
        //         {
        //             label: 'Changed',
        //             items: [
        //                 'UI / Neumorphism theme'
        //             ]
        //         }
        //     ]
        // }
    ];

    res.render('changelog', {
        title: 'Disappear',
        changelog
    });
});

module.exports = router;