// Адмінка магазину: статистика, замовлення, товари, промокоди, користувачі
const express = require('express');
const { db } = require('../db');
const { requireRole, ROLES, publicUser } = require('../auth');
const { ah, cleanText } = require('../utils');
const { CATEGORIES, publicProduct, recalcRating } = require('./shop');

const router = express.Router();
router.use(requireRole('moderator')); // «менеджер» = moderator, «адмін» = admin

const STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

router.get('/stats', ah(async (req, res) => {
  const orders = await db.orders.find({});
  const active = orders.filter((o) => o.status !== 'cancelled');
  const revenue = active.reduce((s, o) => s + o.total, 0);

  // Виручка за останні 14 днів
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d.getTime() + 86400000);
    const dayOrders = active.filter((o) => new Date(o.createdAt) >= d && new Date(o.createdAt) < next);
    days.push({ date: d.toISOString().slice(0, 10), revenue: dayOrders.reduce((s, o) => s + o.total, 0), orders: dayOrders.length });
  }

  const productTotals = new Map();
  for (const o of active) for (const l of o.lines) {
    const cur = productTotals.get(l.productId) || { productId: l.productId, name: l.name, qty: 0, revenue: 0 };
    cur.qty += l.qty; cur.revenue += l.total;
    productTotals.set(l.productId, cur);
  }

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]));
  const lowStock = (await db.products.find({ hidden: false })).filter((p) => p.stock <= 5).map((p) => ({ id: p._id, name: p.name, stock: p.stock }));

  res.json({
    revenue,
    orders: orders.length,
    avgCheck: active.length ? Math.round(revenue / active.length) : 0,
    customers: await db.users.count({}),
    byStatus,
    days,
    top: [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    lowStock,
  });
}));

/* ---------- Замовлення ---------- */
router.get('/orders', ah(async (req, res) => {
  const query = STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
  let items = await db.orders.find(query, { sort: { createdAt: -1 }, limit: 300 });
  const q = cleanText(req.query.q, 40).toLowerCase();
  if (q) items = items.filter((o) => `${o.number} ${o.customer.name} ${o.customer.phone}`.toLowerCase().includes(q));
  res.json({ items: items.map(({ _id, accessToken, ...o }) => ({ id: _id, ...o })) });
}));

router.patch('/orders/:id', ah(async (req, res) => {
  const order = await db.orders.findOne({ _id: req.params.id });
  if (!order) return res.status(404).json({ error: 'not_found' });
  const status = req.body.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'bad_status' });
  if (status === order.status) return res.json({ ok: true });

  // Скасування повертає товар на склад
  if (status === 'cancelled' && order.status !== 'cancelled') {
    for (const l of order.lines) {
      const p = await db.products.findOne({ _id: l.productId });
      if (p) await db.products.update({ _id: p._id }, { stock: p.stock + l.qty, sales: Math.max(0, (p.sales || 0) - l.qty) });
    }
  }
  const history = [...(order.history || []), { status, at: new Date(), by: req.user.username }];
  await db.orders.update({ _id: order._id }, { status, history });
  res.json({ ok: true });
}));

/* ---------- Товари ---------- */
function productFromBody(body) {
  const errors = {};
  const name = cleanText(body.name, 80);
  const category = CATEGORIES[body.category] ? body.category : null;
  const variants = (Array.isArray(body.variants) ? body.variants : []).slice(0, 6).map((v, i) => ({
    id: cleanText(v.id, 20) || String(i + 1),
    label: cleanText(v.label, 30),
    price: Math.round(Number(v.price)),
  })).filter((v) => v.label && v.price > 0);
  if (name.length < 2) errors.name = 'required';
  if (!category) errors.category = 'required';
  if (!variants.length) errors.variants = 'required';
  const color = /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#b07a4a';
  return {
    errors,
    data: {
      name, category, variants, color,
      short: cleanText(body.short, 160),
      description: cleanText(body.description, 3000),
      origin: cleanText(body.origin, 60) || null,
      roast: ['light', 'medium', 'dark'].includes(body.roast) ? body.roast : null,
      notes: (Array.isArray(body.notes) ? body.notes : String(body.notes || '').split(','))
        .map((n) => cleanText(n, 30)).filter(Boolean).slice(0, 6),
      badge: cleanText(body.badge, 20) || null,
      stock: Math.max(0, Math.floor(Number(body.stock) || 0)),
      options: category === 'coffee' ? { grind: ['У зернах', 'Під еспресо', 'Під фільтр', 'Під турку'] } : {},
    },
  };
}

router.get('/products', ah(async (req, res) => {
  const items = await db.products.find({}, { sort: { sort: 1, createdAt: -1 } });
  res.json({ items: items.map((p) => ({ ...publicProduct(p), hidden: p.hidden, sales: p.sales || 0 })) });
}));

router.post('/products', ah(async (req, res) => {
  const { errors, data } = productFromBody(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'validation', fields: errors });
  const slug = data.name.toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'product';
  let id = slug;
  let n = 2;
  while (await db.products.findOne({ _id: id })) id = `${slug}-${n++}`;
  const product = await db.products.insert({
    _id: id, ...data, image: 'img/products/_generic.svg', hidden: false,
    rating: null, ratingCount: 0, sales: 0, sort: 999, createdAt: new Date(),
  });
  res.status(201).json({ product: publicProduct(product) });
}));

router.put('/products/:id', ah(async (req, res) => {
  const existing = await db.products.findOne({ _id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const { errors, data } = productFromBody(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'validation', fields: errors });
  await db.products.update({ _id: existing._id }, data);
  res.json({ ok: true });
}));

router.patch('/products/:id', ah(async (req, res) => {
  const update = {};
  if (typeof req.body.hidden === 'boolean') update.hidden = req.body.hidden;
  if (req.body.stock !== undefined) update.stock = Math.max(0, Math.floor(Number(req.body.stock) || 0));
  await db.products.update({ _id: req.params.id }, update);
  res.json({ ok: true });
}));

/* ---------- Промокоди ---------- */
router.get('/promos', ah(async (req, res) => {
  const items = await db.promos.find({}, { sort: { createdAt: -1 } });
  res.json({ items: items.map(({ _id, ...p }) => ({ code: _id, ...p })) });
}));

router.post('/promos', ah(async (req, res) => {
  const code = cleanText(req.body.code, 20).toUpperCase();
  const type = req.body.type === 'fixed' ? 'fixed' : 'percent';
  const value = Math.round(Number(req.body.value));
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return res.status(400).json({ error: 'bad_code' });
  if (!(value > 0) || (type === 'percent' && value > 90)) return res.status(400).json({ error: 'bad_value' });
  if (await db.promos.findOne({ _id: code })) return res.status(409).json({ error: 'exists' });
  await db.promos.insert({ _id: code, type, value, minTotal: Math.max(0, Number(req.body.minTotal) || 0), active: true, uses: 0, createdAt: new Date() });
  res.status(201).json({ ok: true });
}));

router.patch('/promos/:code', ah(async (req, res) => {
  await db.promos.update({ _id: req.params.code }, { active: !!req.body.active });
  res.json({ ok: true });
}));

/* ---------- Відгуки й користувачі ---------- */
router.post('/reviews/:id/hide', ah(async (req, res) => {
  const review = await db.reviews.findOne({ _id: req.params.id });
  if (!review) return res.status(404).json({ error: 'not_found' });
  await db.reviews.update({ _id: review._id }, { hidden: true });
  await recalcRating(review.productId);
  res.json({ ok: true });
}));

router.get('/users', ah(async (req, res) => {
  const q = cleanText(req.query.q, 20).toLowerCase();
  let users = await db.users.find({}, { sort: { createdAt: -1 }, limit: 500 });
  if (q) users = users.filter((u) => u.usernameLower.includes(q));
  res.json({ items: users.slice(0, 100).map(publicUser) });
}));

router.post('/users/:id/role', requireRole('admin'), ah(async (req, res) => {
  if (!ROLES.includes(req.body.role) || req.params.id === req.user._id) return res.status(400).json({ error: 'bad_role' });
  await db.users.update({ _id: req.params.id }, { role: req.body.role });
  res.json({ ok: true });
}));

module.exports = router;
