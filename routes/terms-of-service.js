const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('terms-of-service', {
        title: 'Disappear'
    });
});

module.exports = router;