var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

let logger = null;
try { logger = require('morgan'); } catch (e) { logger = null; }

require('dotenv').config();

const uri = process.env.MONGO_URI;

mongoose.Promise = global.Promise;
mongoose.set('strictQuery', true);
if (uri) {
  mongoose.connect(uri).then(() => console.log('connection successfully!')).catch((err) => console.error(err));
}

var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');
var ratingRouter = require('./routes/rating');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/logout', (req, res) => {
  res.clearCookie('rbx_username', { path: '/' });
  res.clearCookie('rbx_userid', { path: '/' });
  res.clearCookie('rbx_token', { path: '/' });
  res.redirect('/login');
});

if (logger) app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'img')));

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use((req, res, next) => {
  res.locals.config = {
    discord: process.env.DISCORD || '',
    tiktok: process.env.TIKTOK || '',
    youtube: process.env.YOUTUBE || '',
    roblox: process.env.ROBLOX || '',
    game: process.env.GAME || '',
  };
  next();
});

app.use((req, res, next) => {
  const username = req.cookies && req.cookies.rbx_username ? String(req.cookies.rbx_username) : '';
  const userid = req.cookies && req.cookies.rbx_userid ? String(req.cookies.rbx_userid) : '';
  const token = req.cookies && req.cookies.rbx_token ? String(req.cookies.rbx_token) : '';
  res.locals.auth = { username, userid, token };
  next();
});

app.use('/', indexRouter);
app.use('/login', loginRouter);
app.use('/rating', ratingRouter);

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;