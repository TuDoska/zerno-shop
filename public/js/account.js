// Особистий кабінет: замовлення, обране, профіль
const $root = document.getElementById('account');
const STATUS = { new: 'Нове', confirmed: 'Підтверджено', shipped: 'Відправлено', delivered: 'Отримано', cancelled: 'Скасовано' };
let tab = location.hash === '#wishlist' ? 'wishlist' : 'orders';

function shell() {
  const u = App.user;
  const staff = ['moderator', 'admin'].includes(u.role);
  $root.innerHTML = `
    <div class="admin-head">
      <div><p class="eyebrow">Особистий кабінет</p><h1 class="page__title">Привіт, ${esc(u.username)}!</h1></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${staff ? '<a class="btn btn--small" href="admin.html">Адмінка магазину</a>' : ''}
        <button class="btn btn--ghost btn--small" id="logout">Вийти</button>
      </div>
    </div>
    <div class="tabs">
      <button data-tab="orders" class="${tab === 'orders' ? 'is-active' : ''}">Мої замовлення</button>
      <button data-tab="wishlist" class="${tab === 'wishlist' ? 'is-active' : ''}">Обране</button>
    </div>
    <div id="tab-content"></div>`;
  document.getElementById('logout').addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    location.href = './';
  });
  $root.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    history.replaceState(null, '', '#' + tab);
    $root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('is-active', x === b));
    loadTab();
  });
  loadTab();
}

async function loadTab() {
  const box = document.getElementById('tab-content');
  box.innerHTML = skeletons(3, 'row');
  try {
    if (tab === 'orders') {
      const { items } = await api('/orders/mine');
      box.innerHTML = items.length ? `<div style="display:grid;gap:14px">${items.map((o) => `
        <a class="order-card" href="order.html?n=${o.number}">
          <header><b>Замовлення №${o.number}</b><span class="status status--${o.status}">${STATUS[o.status]}</span></header>
          <div class="order-card__thumbs">${o.lines.slice(0, 5).map((l) => `<img src="${esc(l.image)}" alt="${esc(l.name)}">`).join('')}</div>
          <div class="summary__row"><span class="muted small">${fmtDate(o.createdAt)}</span><span class="price">${money(o.total)}</span></div>
        </a>`).join('')}</div>`
        : '<div class="notice">Замовлень поки немає. <a href="catalog.html">До каталогу →</a></div>';
    } else {
      const { items } = await api('/wishlist');
      box.innerHTML = items.length ? `<div class="grid">${items.map(productCard).join('')}</div>`
        : '<div class="notice">Тут зʼявляться товари, які ви позначите ♥</div>';
    }
  } catch (err) { errorBox(box, err.message, loadTab); }
}

document.addEventListener('wishchange', () => { if (tab === 'wishlist') loadTab(); });

App.ready.then(() => {
  if (!App.user) { location.href = 'login.html?next=account.html'; return; }
  shell();
});
