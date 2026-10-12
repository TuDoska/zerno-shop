// Публічні маршрути магазину: товари, кошик, замовлення, відгуки, обране
const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { requireAuth, requireNotBanned } = require('../auth');
const { ah, cleanText } = require('../utils');
const { quote, DELIVERY, PAYMENTS } = require('../pricing');

const router = express.Router();

const CATEGORIES = {
  coffee: 'Кава',
  tea: 'Чай',
  accessories: 'Аксесуари',
  sets: 'Набори',
};
const SORTS = {
  popular: { sales: -1, sort: 1 },
  new: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1 },
};

const publicProduct = (p) => ({
  id: p._id,
  name: p.name,
  category: p.category,
  categoryLabel: CATEGORIES[p.category],
  short: p.short,
  description: p.description,
  image: p.image,
  color: p.color,
  price: p.variants[0].price,
  variants: p.variants,
  options: p.options || {},
  origin: p.origin || null,
  roast: p.roast || null,
  process: p.process || null,
  notes: p.notes || [],
  badge: p.badge || null,
  stock: p.stock,
  rating: p.rating,
  ratingCount: p.ratingCount || 0,
});

/* ---------- Каталог ---------- */
router.get('/meta', ah(async (req, res) => {
  const products = await db.products.find({ hidden: false });
  const categories = Object.entries(CATEGORIES).map(([id, label]) => ({
    id, label, count: products.filter((p) => p.category === id).length,
  }));
  res.json({
    categories,
    delivery: Object.entries(DELIVERY).map(([id, d]) => ({ id, ...d })),
    payments: Object.entries(PAYMENTS).map(([id, label]) => ({ id, label })),
  });
}));

router.get('/products', ah(async (req, res) => {
  const { category, roast, q } = req.query;
  const min = Number(req.query.min) || 0;
  const max = Number(req.query.max) || Infinity;
  const sort = SORTS[req.query.sort] || SORTS.popular;
  const limit = Math.min(Number(req.query.limit) || 60, 100);

  const query = { hidden: false };
  if (CATEGORIES[category]) query.category = category;
  if (['light', 'medium', 'dark'].includes(roast)) query.roast = roast;

  let items = await db.products.find(query, { sort });
  // Ціна і пошук — простіше відфільтрувати в коді (товарів небагато)
  const search = cleanText(q, 60).toLowerCase();
  items = items.filter((p) => {
    const price = p.variants[0].price;
    const text = `${p.name} ${p.origin || ''} ${(p.notes || []).join(' ')} ${p.short}`.toLowerCase();
    return price >= min && price <= max && (!search || text.includes(search));
  });
  if (req.query.sort === 'price_asc' || req.query.sort === 'price_desc') {
    const dir = req.query.sort === 'price_asc' ? 1 : -1;
    items.sort((a, b) => (a.variants[0].price - b.variants[0].price) * dir);
  }
  res.json({ items: items.slice(0, limit).map(publicProduct), total: items.length });
}));

router.get('/products/:id', ah(async (req, res) => {
  const p = await db.products.findOne({ _id: req.params.id });
  if (!p || p.hidden) return res.status(404).json({ error: 'not_found' });
  const related = (await db.products.find({ category: p.category, hidden: false }, { sort: { sales: -1 } }))
    .filter((r) => r._id !== p._id).slice(0, 4);
  res.json({ product: publicProduct(p), related: related.map(publicProduct) });
}));

/* ---------- Кошик ---------- */
router.post('/cart/quote', ah(async (req, res) => {
  res.json(await quote(req.body));
}));

/* ---------- Замовлення ---------- */
async function nextOrderNumber() {
  const counter = await db.counters.findOne({ _id: 'order' });
  const seq = (counter?.seq || 1000) + 1;
  if (counter) await db.counters.update({ _id: 'order' }, { seq });
  else await db.counters.insert({ _id: 'order', seq });
  return seq;
}

const PHONE_RE = /^\+?[\d\s()-]{10,18}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/orders', ah(async (req, res) => {
  const c = req.body.customer || {};
  const customer = {
    name: cleanText(c.name, 80),
    phone: cleanText(c.phone, 20),
    email: cleanText(c.email, 100),
  };
  const deliveryMethod = DELIVERY[req.body.delivery?.method] ? req.body.delivery.method : null;
  const address = {
    city: cleanText(req.body.delivery?.city, 60),
    branch: cleanText(req.body.delivery?.branch, 120),
  };
  const payment = PAYMENTS[req.body.payment] ? req.body.payment : null;

  const fieldErrors = {};
  if (customer.name.length < 2) fieldErrors.name = 'required';
  if (!PHONE_RE.test(customer.phone)) fieldErrors.phone = 'invalid';
  if (customer.email && !EMAIL_RE.test(customer.email)) fieldErrors.email = 'invalid';
  if (!deliveryMethod) fieldErrors.delivery = 'required';
  if (deliveryMethod && deliveryMethod !== 'pickup') {
    if (address.city.length < 2) fieldErrors.city = 'required';
    if (address.branch.length < 1) fieldErrors.branch = 'required';
  }
  if (!payment) fieldErrors.payment = 'required';
  if (Object.keys(fieldErrors).length) return res.status(400).json({ error: 'validation', fields: fieldErrors });

  const q = await quote({ items: req.body.items, promo: req.body.promo, delivery: deliveryMethod });
  if (!q.lines.length) return res.status(400).json({ error: 'empty_cart' });
  const blocking = q.errors.filter((e) => ['not_found', 'out_of_stock', 'promo_invalid', 'promo_min'].includes(e.error));
  if (blocking.length) return res.status(409).json({ error: 'cart_changed', quote: q });

  // Списуємо залишки
  for (const line of q.lines) {
    const p = await db.products.findOne({ _id: line.productId });
    await db.products.update({ _id: p._id }, { stock: Math.max(0, p.stock - line.qty), sales: (p.sales || 0) + line.qty });
  }
  if (q.promo) {
    const promo = await db.promos.findOne({ _id: q.promo.code });
    await db.promos.update({ _id: promo._id }, { uses: (promo.uses || 0) + 1 });
  }

  const number = await nextOrderNumber();
  const order = await db.orders.insert({
    number,
    accessToken: crypto.randomBytes(16).toString('hex'), // щоб гість міг відкрити своє замовлення
    userId: req.user?._id || null,
    customer,
    delivery: { method: deliveryMethod, label: q.delivery.label, price: q.delivery.price, ...address },
    payment,
    paymentLabel: PAYMENTS[payment],
    comment: cleanText(req.body.comment, 500),
    lines: q.lines,
    subtotal: q.subtotal,
    discount: q.discount,
    promo: q.promo?.code || null,
    total: q.total,
    status: 'new',
    history: [{ status: 'new', at: new Date() }],
    createdAt: new Date(),
  });
  res.status(201).json({ number: order.number, token: order.accessToken });
}));

const publicOrder = (o) => ({
  number: o.number, status: o.status, history: o.history, customer: o.customer, delivery: o.delivery,
  payment: o.payment, paymentLabel: o.paymentLabel, comment: o.comment, lines: o.lines,
  subtotal: o.subtotal, discount: o.discount, promo: o.promo, total: o.total, createdAt: o.createdAt,
});

router.get('/orders/mine', requireAuth, ah(async (req, res) => {
  const orders = await db.orders.find({ userId: req.user._id }, { sort: { createdAt: -1 }, limit: 50 });
  res.json({ items: orders.map(publicOrder) });
}));

router.get('/orders/:number', ah(async (req, res) => {
  const order = await db.orders.findOne({ number: Number(req.params.number) });
  const allowed = order && (
    (req.query.token && req.query.token === order.accessToken) ||
    (req.user && (order.userId === req.user._id || ['moderator', 'admin'].includes(req.user.role)))
  );
  if (!allowed) return res.status(404).json({ error: 'not_found' });
  res.json({ order: publicOrder(order) });
}));

/* ---------- Відгуки ---------- */
async function recalcRating(productId) {
  const reviews = await db.reviews.find({ productId, hidden: { $ne: true } });
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  await db.products.update({ _id: productId }, { rating: avg && Math.round(avg * 10) / 10, ratingCount: reviews.length });
}

router.get('/reviews/:productId', ah(async (req, res) => {
  const items = await db.reviews.find({ productId: req.params.productId, hidden: { $ne: true } }, { sort: { createdAt: -1 }, limit: 100 });
  res.json({
    items: items.map((r) => ({ id: r._id, username: r.username, rating: r.rating, text: r.text, verified: r.verified, createdAt: r.createdAt, mine: r.userId === req.user?._id })),
  });
}));

router.post('/reviews/:productId', requireAuth, requireNotBanned, ah(async (req, res) => {
  const productId = req.params.productId;
  if (!(await db.products.findOne({ _id: productId }))) return res.status(404).json({ error: 'not_found' });
  const rating = Number(req.body.rating);
  const text = cleanText(req.body.text, 1500);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'bad_rating' });
  if (text.length < 3) return res.status(400).json({ error: 'text_too_short' });

  // «Перевірена покупка», якщо користувач замовляв цей товар
  const orders = await db.orders.find({ userId: req.user._id });
  const verified = orders.some((o) => o.status !== 'cancelled' && o.lines.some((l) => l.productId === productId));

  const existing = await db.reviews.findOne({ productId, userId: req.user._id });
  if (existing) await db.reviews.update({ _id: existing._id }, { rating, text, verified, updatedAt: new Date() });
  else await db.reviews.insert({ productId, userId: req.user._id, username: req.user.username, rating, text, verified, hidden: false, createdAt: new Date() });
  await recalcRating(productId);
  res.status(existing ? 200 : 201).json({ ok: true });
}));

/* ---------- Обране ---------- */
router.get('/wishlist', requireAuth, ah(async (req, res) => {
  const rows = await db.wishlist.find({ userId: req.user._id }, { sort: { createdAt: -1 } });
  const products = [];
  for (const r of rows) {
    const p = await db.products.findOne({ _id: r.productId });
    if (p && !p.hidden) products.push(publicProduct(p));
  }
  res.json({ items: products });
}));

router.post('/wishlist/:productId', requireAuth, ah(async (req, res) => {
  const productId = req.params.productId;
  if (!(await db.products.findOne({ _id: productId }))) return res.status(404).json({ error: 'not_found' });
  if (!(await db.wishlist.findOne({ userId: req.user._id, productId }))) {
    await db.wishlist.insert({ userId: req.user._id, productId, createdAt: new Date() });
  }
  res.json({ ok: true });
}));

router.delete('/wishlist/:productId', requireAuth, ah(async (req, res) => {
  await db.wishlist.remove({ userId: req.user._id, productId: req.params.productId });
  res.json({ ok: true });
}));

module.exports = { router, recalcRating, CATEGORIES, publicProduct };
