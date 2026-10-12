// Інтеграційні тести магазину: npm test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-test-'));
process.env.NODE_ENV = 'test';
const { createApp } = require('../server/index');

function client(base) {
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b), patch: (u, b) => call('PATCH', u, b), put: (u, b) => call('PUT', u, b), del: (u) => call('DELETE', u) };
}

const orderBody = (items, extra = {}) => ({
  items,
  customer: { name: 'Олена Петренко', phone: '+380 67 123 45 67', email: 'olena@example.com' },
  delivery: { method: 'nova_branch', city: 'Київ', branch: 'Відділення №12' },
  payment: 'cod',
  ...extra,
});

(async () => {
  const { server } = await createApp();
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const results = [];
  const test = async (name, fn) => { try { await fn(); results.push(['✔', name]); } catch (e) { results.push(['✘', name, e.message]); } };

  const admin = client(base);
  const buyer = client(base);
  const guest = client(base);
  await admin.post('/api/auth/register', { username: 'boss', password: 'secret123' });
  await buyer.post('/api/auth/register', { username: 'olena', password: 'secret123' });

  await test('каталог: товари, категорії, фільтри, пошук', async () => {
    const all = await guest.get('/api/products');
    assert.strictEqual(all.body.total, 24);
    const coffee = await guest.get('/api/products?category=coffee&roast=light');
    assert.ok(coffee.body.items.every((p) => p.category === 'coffee' && p.roast === 'light'));
    const cheap = await guest.get('/api/products?max=200&sort=price_asc');
    const prices = cheap.body.items.map((p) => p.price);
    assert.deepStrictEqual(prices, [...prices].sort((a, b) => a - b));
    assert.ok(prices.every((p) => p <= 200));
    assert.ok((await guest.get('/api/products?q=шоколад')).body.total >= 3);
    const one = await guest.get('/api/products/ethiopia-guji');
    assert.strictEqual(one.body.product.variants.length, 2);
    assert.strictEqual((await guest.get('/api/products/nope')).status, 404);
  });

  await test('кошик: ціни з сервера, промокод, безкоштовна доставка', async () => {
    const q = await guest.post('/api/cart/quote', { items: [{ productId: 'espresso-zerno', variantId: '250', qty: 2, price: 1 }], delivery: 'nova_branch' });
    assert.strictEqual(q.body.subtotal, 640); // ціну 1 з браузера проігноровано
    assert.strictEqual(q.body.delivery.price, 80);
    const p = await guest.post('/api/cart/quote', { items: [{ productId: 'hand-grinder', qty: 1 }], promo: 'zerno10' });
    assert.strictEqual(p.body.discount, 189);
    assert.strictEqual(p.body.delivery.price, 0); // 1701 ≥ 1500
    const bad = await guest.post('/api/cart/quote', { items: [{ productId: 'sencha', qty: 1 }], promo: 'WELCOME' });
    assert.ok(bad.body.errors.some((e) => e.error === 'promo_min'));
  });

  let guestOrder;
  await test('замовлення гостя: валідація, номер, списання залишку', async () => {
    const invalid = await guest.post('/api/orders', orderBody([{ productId: 'sencha', qty: 1 }], { customer: { name: 'О', phone: '12' } }));
    assert.strictEqual(invalid.status, 400);
    assert.ok(invalid.body.fields.phone && invalid.body.fields.name);
    const r = await guest.post('/api/orders', orderBody([{ productId: 'sencha', variantId: '100', qty: 3 }]));
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.number, 1001);
    guestOrder = r.body;
    const view = await guest.get(`/api/orders/${r.body.number}?token=${r.body.token}`);
    assert.strictEqual(view.body.order.total, 380 * 3 + 80);
    assert.strictEqual((await guest.get(`/api/orders/${r.body.number}?token=wrong`)).status, 404);
    assert.strictEqual((await guest.get('/api/products/sencha')).body.product.stock, 47);
  });

  await test('замовлення користувача, історія, перевірений відгук', async () => {
    const r = await buyer.post('/api/orders', orderBody([{ productId: 'kenya-nyeri', variantId: '1000', grind: 'Під фільтр', qty: 1 }], { promo: 'WELCOME', payment: 'card_transfer' }));
    assert.strictEqual(r.status, 201);
    const mine = await buyer.get('/api/orders/mine');
    assert.strictEqual(mine.body.items.length, 1);
    assert.strictEqual(mine.body.items[0].lines[0].grind, 'Під фільтр');
    assert.strictEqual(mine.body.items[0].discount, 100);
    await buyer.post('/api/reviews/kenya-nyeri', { rating: 5, text: 'Неймовірна смородина!' });
    const reviews = await guest.get('/api/reviews/kenya-nyeri');
    assert.strictEqual(reviews.body.items[0].verified, true);
    assert.strictEqual((await guest.get('/api/products/kenya-nyeri')).body.product.rating, 5);
  });

  await test('обране', async () => {
    await buyer.post('/api/wishlist/rooibos');
    await buyer.post('/api/wishlist/rooibos');
    assert.strictEqual((await buyer.get('/api/wishlist')).body.items.length, 1);
    await buyer.del('/api/wishlist/rooibos');
    assert.strictEqual((await buyer.get('/api/wishlist')).body.items.length, 0);
  });

  await test('адмінка: доступ, статистика, статуси, скасування повертає склад', async () => {
    assert.strictEqual((await buyer.get('/api/admin/stats')).status, 403);
    const stats = await admin.get('/api/admin/stats');
    assert.strictEqual(stats.body.orders, 2);
    assert.strictEqual(stats.body.days.length, 14);
    const orders = (await admin.get('/api/admin/orders')).body.items;
    const g = orders.find((o) => o.number === guestOrder.number);
    await admin.patch(`/api/admin/orders/${g.id}`, { status: 'cancelled' });
    assert.strictEqual((await guest.get('/api/products/sencha')).body.product.stock, 50);
    const after = await admin.get('/api/admin/stats');
    assert.strictEqual(after.body.byStatus.cancelled, 1);
  });

  await test('адмінка: товари і промокоди', async () => {
    const created = await admin.post('/api/admin/products', { name: 'Панама Гейша', category: 'coffee', roast: 'light', variants: [{ id: '100', label: '100 г', price: 990 }], stock: 10, notes: 'жасмин, манго' });
    assert.strictEqual(created.status, 201);
    const id = created.body.product.id;
    assert.deepStrictEqual(created.body.product.notes, ['жасмин', 'манго']);
    await admin.patch(`/api/admin/products/${id}`, { hidden: true });
    assert.strictEqual((await guest.get(`/api/products/${id}`)).status, 404);
    assert.strictEqual((await admin.post('/api/admin/promos', { code: 'COFFEE20', type: 'percent', value: 20 })).status, 201);
    const q = await guest.post('/api/cart/quote', { items: [{ productId: 'assam', qty: 1 }], promo: 'coffee20' });
    assert.strictEqual(q.body.discount, 32);
    await admin.patch('/api/admin/promos/COFFEE20', { active: false });
    const q2 = await guest.post('/api/cart/quote', { items: [{ productId: 'assam', qty: 1 }], promo: 'coffee20' });
    assert.ok(q2.body.errors.some((e) => e.error === 'promo_invalid'));
  });

  await test('безпека: чужий Origin, 404 API', async () => {
    const r = await fetch(base + '/api/orders', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await fetch(base + '/api/nope')).status, 404);
  });

  for (const [mark, name, err] of results) console.log(mark, name, err ? '→ ' + err : '');
  const failed = results.filter((r) => r[0] === '✘').length;
  console.log(failed ? `\n${failed} тест(ів) не пройшли` : `\nУсі ${results.length} тестів пройшли`);
  server.close();
  process.exit(failed ? 1 : 0);
})();
