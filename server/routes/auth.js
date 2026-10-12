const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { setAuthCookie, clearAuthCookie, publicUser, requireAuth } = require('../auth');
const { ah, cleanText } = require('../utils');

const router = express.Router();
const LANGS = ['uk', 'en', 'ru'];
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

router.post('/register', ah(async (req, res) => {
  const username = cleanText(req.body.username, 20);
  const password = String(req.body.password || '');
  const lang = LANGS.includes(req.body.lang) ? req.body.lang : null;

  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'bad_username' });
  if (password.length < 6 || password.length > 100) return res.status(400).json({ error: 'bad_password' });

  const usernameLower = username.toLowerCase();
  if (await db.users.findOne({ usernameLower })) return res.status(409).json({ error: 'username_taken' });

  // Перший користувач (або ADMIN_USERNAME) стає адміністратором
  const isFirst = (await db.users.count({})) === 0;
  const isAdminName = process.env.ADMIN_USERNAME && process.env.ADMIN_USERNAME.toLowerCase() === usernameLower;

  let user;
  try {
    user = await db.users.insert({
      username,
      usernameLower,
      passwordHash: await bcrypt.hash(password, 10),
      role: isFirst || isAdminName ? 'admin' : 'user',
      lang,
      banned: false,
      createdAt: new Date(),
    });
  } catch (error) {
    // Одночасна реєстрація того самого імені → унікальний індекс
    return res.status(409).json({ error: 'username_taken' });
  }

  setAuthCookie(res, user._id);
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/login', ah(async (req, res) => {
  const usernameLower = cleanText(req.body.username, 20).toLowerCase();
  const password = String(req.body.password || '');
  const user = await db.users.findOne({ usernameLower });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'bad_credentials' });
  }
  setAuthCookie(res, user._id);
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/me', requireAuth, ah(async (req, res) => {
  const update = {};
  if (LANGS.includes(req.body.lang)) update.lang = req.body.lang;
  if (Object.keys(update).length) await db.users.update({ _id: req.user._id }, update);
  res.json({ user: publicUser({ ...req.user, ...update }) });
}));

module.exports = router;
