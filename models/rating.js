const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema({
    roblox_user_id: String,
    discord_user_id: String,
    user_number: String,
    token: String,
    rating: Number,
    message: String,
    updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rating', RatingSchema, 'ratings');