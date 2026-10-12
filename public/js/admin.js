// Адмінка магазину
const $root = document.getElementById('admin');
const STATUS = { new: 'Нове', confirmed: 'Підтверджено', shipped: 'Відправлено', delivered: 'Отримано', cancelled: 'Скасовано' };
const CATS = { coffee: 'Кава', tea: 'Чай', accessories: 'Аксесуари', sets: 'Набори' };
let tab = (location.hash || '#dashboard').slice(1);
let orderFilter = '';

function shell() {
  $root.innerHTML = `
    <div class="admin-head">
      <div><p class="eyebrow">Адмін-панель</p><h1 class="page__title">Керування магазином</h1></div>
      <span class="chip">${esc(App.user.username)} · ${App.user.role === 'admin' ? 'адміністратор' : 'менеджер'}</span>
    </div>
    <div class="tabs">
      ${[['dashboard', 'Огляд'], ['orders', 'Замовлення'], ['products', 'Товари'], ['promos', 'Промокоди']]
        .map(([id, l]) => `<button data-tab="${id}" class="${tab === id ? 'is-active' : ''}">${l}</button>`).join('')}
    </div>
    <div id="tab"></div>`;
  $root.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    history.replaceState(null, '', '#' + tab);
    $root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('is-active', x === b));
    load();
  });
  load();
}

function load() {
  const box = document.getElementById('tab');
  box.innerHTML = skeletons(3, 'row');
  ({ dashboard, orders, products, promos }[tab] || dashboard)(box).catch((err) => errorBox(box, err.message, load));
}

/* ---------- Огляд ---------- */
function barChart(days) {
  const W = 640, H = 240, pad = 28;
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const bw = (W - pad * 2) / days.length;
  const bars = days.map((d, i) => {
    const h = (d.revenue / max) * (H - pad * 2);
    const x = pad + i * bw + 4;
    const y = H - pad - h;
    const label = new Date(d.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'numeric' });
    return `<rect class="bar-rect" x="${x}" y="${y}" width="${bw - 8}" height="${Math.max(h, 1)}" rx="5"><title>${label}: ${money(d.revenue)} (${d.orders} зам.)</title></rect>
      ${i % 2 === 0 ? `<text x="${x + (bw - 8) / 2}" y="${H - 8}" text-anchor="middle">${label}</text>` : ''}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Виручка за 14 днів">
    <line x1="${pad}" x2="${W - pad}" y1="${H - pad}" y2="${H - pad}" stroke="#e3d5c1"/>
    <text x="${pad}" y="14">${money(max)}</text>${bars}</svg>`;
}

async function dashboard(box) {
  const s = await api('/admin/stats');
  const maxTop = Math.max(1, ...s.top.map((t) => t.revenue));
  box.innerHTML = `
    <div class="stats">
      <div class="stat stat--dark"><span>Виручка</span><b>${money(s.revenue)}</b></div>
      <div class="stat"><span>Замовлень</span><b>${s.orders}</b></div>
      <div class="stat"><span>Середній чек</span><b>${money(s.avgCheck)}</b></div>
      <div class="stat"><span>Нових</span><b>${s.byStatus.new}</b></div>
    </div>
    <div class="dash-grid">
      <section class="panel"><h2 class="panel__title">Виручка за 14 днів</h2>${barChart(s.days)}</section>
      <section class="panel"><h2 class="panel__title">Топ товарів</h2>
        ${s.top.length ? `<ul class="top-list">${s.top.map((t) => `<li><span>${esc(t.name)}</span><span>${money(t.revenue)}</span>
          <div class="bar"><i style="width:${(t.revenue / maxTop) * 100}%"></i></div></li>`).join('')}</ul>` : '<p class="muted">Ще немає продажів</p>'}
        ${s.lowStock.length ? `<h3 style="margin:20px 0 8px;font-size:15px">⚠ Закінчуються</h3>
          <ul class="top-list">${s.lowStock.map((p) => `<li><span>${esc(p.name)}</span><b>${p.stock} шт</b></li>`).join('')}</ul>` : ''}
      </section>
    </div>`;
}

/* ---------- Замовлення ---------- */
async function orders(box) {
  const { items } = await api('/admin/orders' + (orderFilter ? `?status=${orderFilter}` : ''));
  box.innerHTML = `
    <div class="toolbar">
      <div class="tabs" style="margin:0">${[['', 'Усі'], ...Object.entries(STATUS)].map(([v, l]) => `<button data-filter="${v}" class="${orderFilter === v ? 'is-active' : ''}">${l}</button>`).join('')}</div>
    </div>
    ${items.length ? `<div class="table-wrap"><table>
      <thead><tr><th>№</th><th>Дата</th><th>Клієнт</th><th>Товари</th><th>Сума</th><th>Статус</th></tr></thead>
      <tbody>${items.map((o) => `
        <tr>
          <td><b>${o.number}</b></td>
          <td class="small">${fmtDate(o.createdAt)}</td>
          <td>${esc(o.customer.name)}<div class="muted small">${esc(o.customer.phone)}</div></td>
          <td class="small">${o.lines.map((l) => `${esc(l.name)} (${esc(l.variantLabel)}) × ${l.qty}`).join('<br>')}
            <details><summary class="link small">Деталі</summary><div class="order-details">
              <span>🚚 ${esc(o.delivery.label)} ${esc([o.delivery.city, o.delivery.branch].filter(Boolean).join(', '))}</span>
              <span>💳 ${esc(o.paymentLabel)}</span>
              ${o.promo ? `<span>🏷 ${esc(o.promo)} (−${money(o.discount)})</span>` : ''}
              ${o.comment ? `<span>💬 ${esc(o.comment)}</span>` : ''}
              ${o.lines.some((l) => l.grind) ? `<span>⚙ Помел: ${o.lines.filter((l) => l.grind).map((l) => esc(l.grind)).join(', ')}</span>` : ''}
            </div></details></td>
          <td class="price">${money(o.total)}</td>
          <td><select class="field field--small" data-status="${esc(o.id)}">
            ${Object.entries(STATUS).map(([v, l]) => `<option value="${v}" ${o.status === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="notice">Замовлень немає</div>'}`;
}

/* ---------- Товари ---------- */
async function products(box) {
  const { items } = await api('/admin/products');
  box.innerHTML = `
    <div class="toolbar"><span class="muted">${items.length} товарів</span><button class="btn btn--accent btn--small" id="new-product">+ Новий товар</button></div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Назва</th><th>Категорія</th><th>Ціна</th><th>Продано</th><th>Склад</th><th></th></tr></thead>
      <tbody>${items.map((p) => `
        <tr class="${p.hidden ? 'row-hidden' : ''}">
          <td><img src="${esc(p.image)}" alt=""></td>
          <td><b>${esc(p.name)}</b>${p.hidden ? ' <span class="chip">приховано</span>' : ''}</td>
          <td>${esc(CATS[p.category])}</td>
          <td class="price">${p.variants.map((v) => `${esc(v.label)}: ${money(v.price)}`).join('<br>')}</td>
          <td>${p.sales}</td>
          <td><input class="field inline-input" type="number" min="0" value="${p.stock}" data-stock="${esc(p.id)}" aria-label="Залишок"></td>
          <td style="white-space:nowrap"><button class="link small" data-edit="${esc(p.id)}">Змінити</button> ·
            <button class="link small" data-hide="${esc(p.id)}" data-hidden="${p.hidden}">${p.hidden ? 'Показати' : 'Сховати'}</button></td>
        </tr>`).join('')}</tbody></table></div>`;
  box.dataset.products = JSON.stringify(items);
}

function productDialog(p) {
  const v = p?.variants || [{ id: '250', label: '250 г', price: '' }];
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.innerHTML = `
    <form class="modal__body admin-form" method="dialog">
      <h3>${p ? 'Редагувати товар' : 'Новий товар'}</h3>
      <label class="label">Назва<input class="field" name="name" required value="${esc(p?.name || '')}"></label>
      <div class="form-row">
        <label class="label">Категорія<select class="field" name="category">${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${p?.category === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="label">Обсмаження<select class="field" name="roast"><option value="">—</option>${Object.entries(ROAST).map(([k, l]) => `<option value="${k}" ${p?.roast === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="label">Склад, шт<input class="field" name="stock" type="number" min="0" value="${p?.stock ?? 20}"></label>
      </div>
      <div class="form-row">
        <label class="label">Вага 1<input class="field" name="v1label" value="${esc(v[0]?.label || '')}"></label>
        <label class="label">Ціна 1, ₴<input class="field" name="v1price" type="number" min="1" value="${v[0]?.price || ''}"></label>
        <label class="label">Країна<input class="field" name="origin" value="${esc(p?.origin || '')}"></label>
      </div>
      <div class="form-row">
        <label class="label">Вага 2<input class="field" name="v2label" value="${esc(v[1]?.label || '')}"></label>
        <label class="label">Ціна 2, ₴<input class="field" name="v2price" type="number" min="1" value="${v[1]?.price || ''}"></label>
        <label class="label">Мітка<input class="field" name="badge" value="${esc(p?.badge || '')}" placeholder="Хіт, Новинка…"></label>
      </div>
      <label class="label">Смакові ноти (через кому)<input class="field" name="notes" value="${esc((p?.notes || []).join(', '))}"></label>
      <label class="label">Короткий опис<input class="field" name="short" maxlength="160" value="${esc(p?.short || '')}"></label>
      <label class="label">Опис<textarea class="field" name="description" rows="4">${esc(p?.description || '')}</textarea></label>
      <div class="modal__actions">
        <button class="btn btn--ghost" value="cancel" formnovalidate>Скасувати</button>
        <button class="btn btn--accent" value="save">Зберегти</button>
      </div>
    </form>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue === 'save') {
      const f = dialog.querySelector('form');
      const variants = [[f.v1label.value, f.v1price.value, v[0]?.id || '1'], [f.v2label.value, f.v2price.value, v[1]?.id || '2']]
        .filter(([l, pr]) => l && pr).map(([label, price, id]) => ({ id, label, price: Number(price) }));
      const body = {
        name: f.name.value, category: f.category.value, roast: f.roast.value, stock: f.stock.value, origin: f.origin.value,
        badge: f.badge.value, notes: f.notes.value, short: f.short.value, description: f.description.value, variants, color: p?.color,
      };
      try {
        await api(p ? `/admin/products/${encodeURIComponent(p.id)}` : '/admin/products', { method: p ? 'PUT' : 'POST', body });
        toast('Товар збережено');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }
    dialog.remove();
  });
}

/* ---------- Промокоди ---------- */
async function promos(box) {
  const { items } = await api('/admin/promos');
  box.innerHTML = `
    <div class="dash-grid">
      <div class="table-wrap"><table>
        <thead><tr><th>Код</th><th>Знижка</th><th>Мін. сума</th><th>Використано</th><th>Активний</th></tr></thead>
        <tbody>${items.map((p) => `<tr class="${p.active ? '' : 'row-hidden'}">
          <td><b>${esc(p.code)}</b></td><td>${p.type === 'percent' ? p.value + '%' : money(p.value)}</td>
          <td>${p.minTotal ? money(p.minTotal) : '—'}</td><td>${p.uses}</td>
          <td><input type="checkbox" data-promo="${esc(p.code)}" ${p.active ? 'checked' : ''} aria-label="Активний"></td></tr>`).join('')}</tbody>
      </table></div>
      <form class="panel admin-form" id="promo-form">
        <h2 class="panel__title">Новий промокод</h2>
        <label class="label">Код<input class="field" name="code" required pattern="[A-Za-z0-9_-]{3,20}" placeholder="AUTUMN15"></label>
        <div class="form-row" style="grid-template-columns:1fr 1fr">
          <label class="label">Тип<select class="field" name="type"><option value="percent">Відсоток</option><option value="fixed">Сума, ₴</option></select></label>
          <label class="label">Значення<input class="field" name="value" type="number" min="1" required></label>
        </div>
        <label class="label">Мінімальна сума замовлення, ₴<input class="field" name="minTotal" type="number" min="0" value="0"></label>
        <button class="btn btn--accent">Створити</button>
      </form>
    </div>`;
}

/* ---------- Події ---------- */
$root.addEventListener('click', async (e) => {
  const f = e.target.closest('[data-filter]');
  if (f) { orderFilter = f.dataset.filter; load(); return; }
  if (e.target.id === 'new-product') { productDialog(null); return; }
  const edit = e.target.closest('[data-edit]');
  if (edit) {
    const items = JSON.parse(document.getElementById('tab').dataset.products || '[]');
    productDialog(items.find((p) => p.id === edit.dataset.edit));
    return;
  }
  const hide = e.target.closest('[data-hide]');
  if (hide) {
    try { await api(`/admin/products/${encodeURIComponent(hide.dataset.hide)}`, { method: 'PATCH', body: { hidden: hide.dataset.hidden !== 'true' } }); load(); } catch (err) { toast(err.message, 'error'); }
  }
});

$root.addEventListener('change', async (e) => {
  const status = e.target.closest('[data-status]');
  if (status) {
    try { await api(`/admin/orders/${status.dataset.status}`, { method: 'PATCH', body: { status: status.value } }); toast(`Статус: ${STATUS[status.value]}`); } catch (err) { toast(err.message, 'error'); }
    return;
  }
  const stock = e.target.closest('[data-stock]');
  if (stock) {
    try { await api(`/admin/products/${encodeURIComponent(stock.dataset.stock)}`, { method: 'PATCH', body: { stock: Number(stock.value) } }); toast('Залишок оновлено'); } catch (err) { toast(err.message, 'error'); }
    return;
  }
  const promo = e.target.closest('[data-promo]');
  if (promo) {
    try { await api(`/admin/promos/${encodeURIComponent(promo.dataset.promo)}`, { method: 'PATCH', body: { active: promo.checked } }); load(); } catch (err) { toast(err.message, 'error'); }
  }
});

$root.addEventListener('submit', async (e) => {
  if (e.target.id !== 'promo-form') return;
  e.preventDefault();
  const f = e.target;
  try {
    await api('/admin/promos', { method: 'POST', body: { code: f.code.value, type: f.type.value, value: Number(f.value.value), minTotal: Number(f.minTotal.value) } });
    toast('Промокод створено');
    load();
  } catch (err) { toast(err.code === 'exists' ? 'Такий код уже є' : err.message, 'error'); }
});

App.ready.then(() => {
  if (!App.user) { location.href = 'login.html?next=admin.html'; return; }
  if (!['moderator', 'admin'].includes(App.user.role)) {
    $root.innerHTML = '<div class="notice notice--error">Сторінка доступна лише адміністраторам магазину.</div>';
    return;
  }
  shell();
});
