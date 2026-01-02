const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('privacy-policy', {
        title: 'Disappear'
    });
});

module.exports = router;