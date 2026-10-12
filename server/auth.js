// Авторизація: JWT у httpOnly cookie + ролі
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const COOKIE = 'zerno_token';
const ROLES = ['user', 'moderator', 'admin'];

function getSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'change-me') return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET має бути заданий у продакшені');
  }
  // Локально: генеруємо секрет один раз і зберігаємо у data/
  const file = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), '.secret');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString('hex'));
  return fs.readFileSync(file, 'utf8');
}
const SECRET = getSecret();

function setAuthCookie(res, userId) {
  const token = jwt.sign({ uid: userId }, SECRET, { expiresIn: '30d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE);
}

async function userFromToken(token) {
  if (!token) return null;
  try {
    const { uid } = jwt.verify(token, SECRET);
    return await db.users.findOne({ _id: uid });
  } catch {
    return null;
  }
}

// Дістає токен із рядка cookie (для Socket.io)
function tokenFromCookieHeader(header = '') {
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='));
  return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : null;
}

async function loadUser(req, res, next) {
  req.user = await userFromToken(req.cookies?.[COOKIE]);
  next();
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u._id, username: u.username, role: u.role, lang: u.lang || null,
    banned: !!u.banned, banReason: u.banReason || '', createdAt: u.createdAt,
  };
}

const hasRole = (user, role) => !!user && ROLES.indexOf(user.role) >= ROLES.indexOf(role);

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  next();
}

function requireNotBanned(req, res, next) {
  if (req.user?.banned) return res.status(403).json({ error: 'banned', reason: req.user.banReason || '' });
  next();
}

const requireRole = (role) => (req, res, next) => {
  if (!hasRole(req.user, role)) return res.status(403).json({ error: 'forbidden' });
  next();
};

module.exports = {
  COOKIE, ROLES, setAuthCookie, clearAuthCookie, loadUser, userFromToken, tokenFromCookieHeader,
  publicUser, hasRole, requireAuth, requireNotBanned, requireRole,
};
