const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    roblox_user_id: String,
    discord_user_id: String,
    user_number: String,
    token: String,
    updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema, 'users');