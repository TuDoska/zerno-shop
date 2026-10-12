// Розрахунок кошика ЛИШЕ на сервері: ціни з бази, а не з браузера
const { db } = require('./db');

const DELIVERY = {
  nova_branch: { label: 'Нова Пошта — відділення', price: 80, freeFrom: 1500 },
  nova_courier: { label: 'Нова Пошта — курʼєр', price: 140, freeFrom: 2500 },
  pickup: { label: 'Самовивіз з кавʼярні (Львів)', price: 0, freeFrom: 0 },
};
const PAYMENTS = {
  cod: 'Оплата при отриманні',
  card_transfer: 'Переказ на картку після підтвердження',
};
const MAX_QTY = 20;

async function findPromo(code) {
  if (!code) return null;
  const promo = await db.promos.findOne({ _id: String(code).trim().toUpperCase() });
  return promo && promo.active ? promo : null;
}

/**
 * items: [{ productId, variantId, grind, qty }]
 * Повертає рядки з актуальними цінами, знижку, доставку, суму і помилки
 */
async function quote({ items = [], promo = '', delivery = 'nova_branch' } = {}) {
  const lines = [];
  const errors = [];
  const list = Array.isArray(items) ? items.slice(0, 50) : [];

  for (const raw of list) {
    const product = await db.products.findOne({ _id: String(raw.productId || '') });
    if (!product || product.hidden) { errors.push({ productId: raw.productId, error: 'not_found' }); continue; }
    const variant = product.variants.find((v) => v.id === raw.variantId) || product.variants[0];
    const grinds = product.options?.grind || [];
    const grind = grinds.includes(raw.grind) ? raw.grind : (grinds[0] || null);
    let qty = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(raw.qty) || 1)));
    if (product.stock <= 0) { errors.push({ productId: product._id, error: 'out_of_stock' }); continue; }
    if (qty > product.stock) { qty = product.stock; errors.push({ productId: product._id, error: 'stock_limited', stock: product.stock }); }

    lines.push({
      productId: product._id,
      name: product.name,
      image: product.image,
      color: product.color,
      variantId: variant.id,
      variantLabel: variant.label,
      grind,
      price: variant.price,
      qty,
      total: variant.price * qty,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  let discount = 0;
  let promoInfo = null;
  if (promo) {
    const p = await findPromo(promo);
    if (!p) errors.push({ error: 'promo_invalid' });
    else if (subtotal < (p.minTotal || 0)) errors.push({ error: 'promo_min', minTotal: p.minTotal });
    else {
      discount = p.type === 'percent' ? Math.round(subtotal * p.value / 100) : Math.min(p.value, subtotal);
      promoInfo = { code: p._id, type: p.type, value: p.value };
    }
  }

  const d = DELIVERY[delivery] || DELIVERY.nova_branch;
  const afterDiscount = subtotal - discount;
  const deliveryPrice = lines.length && afterDiscount < d.freeFrom ? d.price : 0;

  return {
    lines,
    subtotal,
    discount,
    promo: promoInfo,
    delivery: { method: DELIVERY[delivery] ? delivery : 'nova_branch', label: d.label, price: deliveryPrice, freeFrom: d.freeFrom },
    total: afterDiscount + deliveryPrice,
    errors,
  };
}

module.exports = { quote, findPromo, DELIVERY, PAYMENTS };
