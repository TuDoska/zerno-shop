// Спільне для всіх сторінок «Зерна»: API, кошик, обране, шапка, картки, тости

function esc(text = '') {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const money = (n) => `${Number(n || 0).toLocaleString('uk-UA')} ₴`;
const fmtDate = (d) => new Date(d).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    const err = new Error('Немає зʼєднання з сервером');
    err.code = 'network';
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(ERRORS[data.error] || 'Щось пішло не так. Спробуй ще раз.');
    err.code = res.status === 429 ? 'too_many' : data.error;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const ERRORS = {
  bad_username: 'Імʼя: 3–20 символів — латиниця, цифри або _',
  bad_password: 'Пароль має бути від 6 символів',
  username_taken: 'Це імʼя вже зайняте',
  bad_credentials: 'Неправильне імʼя або пароль',
  auth_required: 'Спершу увійди в акаунт',
  forbidden: 'Недостатньо прав',
  not_found: 'Не знайдено',
  empty_cart: 'Кошик порожній',
  cart_changed: 'Кошик змінився — перевір товари',
  validation: 'Перевір заповнені поля',
  banned: 'Акаунт заблоковано',
};

/* ---------- Користувач ---------- */
const App = { user: null, wish: new Set(), ready: null };

async function loadSession() {
  try { App.user = (await api('/auth/me')).user; } catch { App.user = null; }
  if (App.user) {
    try { App.wish = new Set((await api('/wishlist')).items.map((p) => p.id)); } catch { /* ignore */ }
  }
  renderAccountLink();
  document.dispatchEvent(new CustomEvent('session'));
}

/* ---------- Кошик (localStorage) ---------- */
const CART_KEY = 'zerno-cart';
const Cart = {
  get() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  },
  save(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* ignore */ }
    updateCartCount();
    document.dispatchEvent(new CustomEvent('cartchange'));
  },
  key: (i) => `${i.productId}|${i.variantId}|${i.grind || ''}`,
  add(item) {
    const items = Cart.get();
    const found = items.find((i) => Cart.key(i) === Cart.key(item));
    if (found) found.qty = Math.min(20, found.qty + item.qty);
    else items.push({ ...item, qty: Math.min(20, item.qty) });
    Cart.save(items);
  },
  setQty(key, qty) {
    const items = Cart.get().map((i) => (Cart.key(i) === key ? { ...i, qty: Math.max(1, Math.min(20, qty)) } : i));
    Cart.save(items);
  },
  remove(key) { Cart.save(Cart.get().filter((i) => Cart.key(i) !== key)); },
  clear() { Cart.save([]); },
  count: () => Cart.get().reduce((s, i) => s + i.qty, 0),
};

function updateCartCount() {
  const el = document.querySelector('[data-cart-count]');
  if (!el) return;
  const n = Cart.count();
  el.textContent = n;
  el.hidden = n === 0;
}

/* ---------- Обране ---------- */
async function toggleWish(productId, btn) {
  if (!App.user) {
    toast('Увійди, щоб зберігати товари в обране', 'info', { href: loginUrl(), label: 'Увійти' });
    return;
  }
  const active = App.wish.has(productId);
  try {
    await api('/wishlist/' + productId, { method: active ? 'DELETE' : 'POST' });
    active ? App.wish.delete(productId) : App.wish.add(productId);
    document.querySelectorAll(`[data-wish="${productId}"]`).forEach((b) => b.classList.toggle('is-active', !active));
    document.dispatchEvent(new CustomEvent('wishchange'));
  } catch (err) { toast(err.message, 'error'); }
}

/* ---------- Картка товару ---------- */
const ROAST = { light: 'Світле', medium: 'Середнє', dark: 'Темне' };
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';

function productCard(p) {
  const multi = p.variants.length > 1;
  const meta = p.category === 'coffee' ? `${esc(p.origin)} · ${ROAST[p.roast] || ''}` : esc(p.categoryLabel);
  return `
    <article class="card">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="card__img">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
        <div class="card__badges">
          ${p.badge ? `<span class="chip chip--accent">${esc(p.badge)}</span>` : ''}
        </div>
        ${p.stock <= 0 ? '<div class="out">Немає в наявності</div>' : ''}
      </a>
      <button class="wish ${App.wish.has(p.id) ? 'is-active' : ''}" data-wish="${esc(p.id)}" aria-label="В обране">${HEART}</button>
      <div class="card__body">
        <div class="card__meta"><span>${meta}</span>${p.rating ? `<span class="rating">★ ${p.rating}</span>` : ''}</div>
        <h3 class="card__title"><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <p class="card__notes">${esc(p.notes.length ? p.notes.join(' · ') : p.short)}</p>
        <div class="card__foot">
          <span class="price">${multi ? '<small>від</small> ' : ''}${money(p.price)}</span>
          <button class="btn btn--accent add-btn" data-quick-add="${esc(p.id)}" data-variant="${esc(p.variants[0].id)}"
            data-grind="${esc(p.options?.grind?.[0] || '')}" ${p.stock <= 0 ? 'disabled' : ''} aria-label="Додати в кошик">+</button>
        </div>
      </div>
    </article>`;
}

function skeletons(n, kind = 'card') {
  return Array.from({ length: n }, () => `<div class="skeleton skeleton--${kind}"></div>`).join('');
}

function errorBox(container, message, retry) {
  container.innerHTML = `<div class="notice notice--error"><p>😕 ${esc(message)}</p>${retry ? '<button class="btn btn--small" style="margin-top:12px">Спробувати ще раз</button>' : ''}</div>`;
  if (retry) container.querySelector('button').addEventListener('click', retry);
}

/* ---------- Тости ---------- */
function toast(text, type = 'info', action) {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('role', 'status');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<a href="${esc(action.href)}">${esc(action.label)}</a>` : ''}`;
  box.append(el);
  setTimeout(() => el.classList.add('is-out'), 3500);
  setTimeout(() => el.remove(), 4000);
}

const loginUrl = () => 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);

/* ---------- Делеговані кліки ---------- */
document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-quick-add]');
  if (add) {
    e.preventDefault();
    Cart.add({ productId: add.dataset.quickAdd, variantId: add.dataset.variant, grind: add.dataset.grind || null, qty: 1 });
    const icon = document.querySelector('.cart-btn');
    icon?.classList.remove('bump'); void icon?.offsetWidth; icon?.classList.add('bump');
    toast('Додано в кошик', 'info', { href: 'cart.html', label: 'Перейти' });
    return;
  }
  const wish = e.target.closest('[data-wish]');
  if (wish) { e.preventDefault(); toggleWish(wish.dataset.wish, wish); }
});

/* ---------- Шапка й футер ---------- */
const LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="24" rx="15" ry="20" transform="rotate(30 24 24)" fill="#c8553d"/><path d="M15 33 C22 27 26 21 33 15" stroke="#f7f1e8" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`;
const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

function renderLayout() {
  const page = location.pathname.split('/').pop().replace('.html', '') || 'index';
  const header = document.getElementById('site-header');
  if (header) {
    header.outerHTML = `
      <div class="topbar">☕ Безкоштовна доставка від 1500 ₴ · Обсмажуємо щотижня · Демо-магазин для портфоліо</div>
      <header class="header" id="site-header">
        <div class="container header__inner">
          <a href="./" class="logo" aria-label="Зерно — на головну">${LOGO}<span>Зерно</span></a>
          <nav class="nav">
            <a href="catalog.html" data-page="catalog">Каталог</a>
            <a href="catalog.html?category=coffee" data-page="coffee">Кава</a>
            <a href="catalog.html?category=tea" data-page="tea">Чай</a>
            <a href="catalog.html?category=accessories" data-page="accessories">Аксесуари</a>
            <a href="./#about" data-page="about">Про нас</a>
          </nav>
          <form class="header__search" action="catalog.html" role="search">
            ${ICONS.search}<input type="search" name="q" placeholder="Пошук кави, чаю…" aria-label="Пошук">
          </form>
          <div class="header__actions">
            <a class="icon-btn" href="account.html" id="account-link" aria-label="Акаунт">${ICONS.user}</a>
            <a class="icon-btn cart-btn" href="cart.html" aria-label="Кошик">${ICONS.cart}<span class="count" data-cart-count hidden>0</span></a>
            <button class="icon-btn burger" aria-label="Меню" aria-expanded="false">${ICONS.menu}</button>
          </div>
        </div>
      </header>`;
    const h = document.getElementById('site-header');
    const cat = new URLSearchParams(location.search).get('category');
    h.querySelector(`[data-page="${page === 'catalog' && cat ? cat : page}"]`)?.classList.add('is-active');
    h.querySelector('.burger').addEventListener('click', (e) => {
      const open = h.classList.toggle('is-open');
      e.currentTarget.setAttribute('aria-expanded', open);
    });
  }

  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.outerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer__grid">
            <div>
              <a href="./" class="logo logo--light">${LOGO}<span>Зерно</span></a>
              <p style="margin-top:12px;max-width:320px">Обсмажуємо спешелті-каву невеликими партіями у Львові й відправляємо по всій Україні.</p>
            </div>
            <div><h4>Магазин</h4><ul>
              <li><a href="catalog.html?category=coffee">Кава</a></li><li><a href="catalog.html?category=tea">Чай</a></li>
              <li><a href="catalog.html?category=accessories">Аксесуари</a></li><li><a href="catalog.html?category=sets">Набори</a></li></ul></div>
            <div><h4>Покупцям</h4><ul>
              <li><a href="cart.html">Кошик</a></li><li><a href="account.html">Мої замовлення</a></li>
              <li><a href="./#delivery">Доставка й оплата</a></li></ul></div>
            <div><h4>Контакти</h4><ul>
              <li>Львів, вул. Кавова, 1</li><li>Щодня 8:00–21:00</li><li>hello@zerno.example</li></ul></div>
          </div>
          <div class="footer__bottom">
            <span>© ${new Date().getFullYear()} Зерно. Демонстраційний проєкт для портфоліо — реальні замовлення не обробляються.</span>
            <span>Зроблено з ☕ і JavaScript</span>
          </div>
        </div>
      </footer>`;
  }
  updateCartCount();
}

function renderAccountLink() {
  const link = document.getElementById('account-link');
  if (!link) return;
  if (App.user) {
    link.title = App.user.username;
    link.setAttribute('aria-label', `Акаунт ${App.user.username}`);
  }
}

window.addEventListener('storage', (e) => { if (e.key === CART_KEY) updateCartCount(); });

renderLayout();
App.ready = loadSession();
