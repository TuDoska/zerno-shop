// Сторінка товару
const productId = new URLSearchParams(location.search).get('id');
const $root = document.getElementById('product');
let product = null;
const choice = { variantId: null, grind: null, qty: 1 };

function stars(n) { return '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n)); }

function render(p, related) {
  product = p;
  choice.variantId = p.variants[0].id;
  choice.grind = p.options.grind?.[0] || null;
  document.title = `${p.name} — Зерно`;
  const roastLevel = { light: 1, medium: 2, dark: 3 }[p.roast] || 0;

  $root.innerHTML = `
    <nav class="crumbs"><a href="./">Головна</a> / <a href="catalog.html?category=${p.category}">${esc(p.categoryLabel)}</a> / ${esc(p.name)}</nav>
    <div class="product">
      <div class="product__gallery"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
      <div class="product__info">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${p.badge ? `<span class="chip chip--accent">${esc(p.badge)}</span>` : ''}
          <span class="chip">${esc(p.categoryLabel)}</span>
          ${p.rating ? `<a href="#reviews" class="chip chip--gold">★ ${p.rating} · ${p.ratingCount} відгуків</a>` : ''}
        </div>
        <h1 class="product__title">${esc(p.name)}</h1>
        <p class="product__short">${esc(p.short)}</p>
        ${p.category === 'coffee' ? `
          <div class="specs">
            <div class="spec"><span>Країна</span><b>${esc(p.origin)}</b></div>
            <div class="spec"><span>Обробка</span><b>${esc(p.process)}</b></div>
            <div class="spec"><span>Обсмаження</span><b>${ROAST[p.roast]}</b>
              <div class="roast-meter">${[1, 2, 3].map((i) => `<i class="${i <= roastLevel ? 'on' : ''}"></i>`).join('')}</div></div>
          </div>
          <p><b>Смакові ноти:</b> ${esc(p.notes.join(', '))}</p>` : p.notes.length ? `<p><b>Смак:</b> ${esc(p.notes.join(', '))}</p>` : ''}

        <div class="product__price" id="price">${money(p.variants[0].price)}</div>

        ${p.variants.length > 1 ? `
          <div class="option-group"><span>Вага</span>
            <div class="pills" data-group="variant">${p.variants.map((v, i) => `<button class="pill ${i === 0 ? 'is-active' : ''}" data-value="${esc(v.id)}">${esc(v.label)}</button>`).join('')}</div>
          </div>` : ''}
        ${p.options.grind ? `
          <div class="option-group"><span>Помел</span>
            <div class="pills" data-group="grind">${p.options.grind.map((g, i) => `<button class="pill ${i === 0 ? 'is-active' : ''}" data-value="${esc(g)}">${esc(g)}</button>`).join('')}</div>
          </div>` : ''}

        <div class="buy-row">
          <div class="qty"><button data-qty="-1" aria-label="Менше">−</button><input id="qty" type="number" min="1" max="20" value="1" aria-label="Кількість"><button data-qty="1" aria-label="Більше">+</button></div>
          <button class="btn btn--accent" id="add" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Немає в наявності' : 'Додати в кошик'}</button>
          <button class="btn btn--ghost wish-big ${App.wish.has(p.id) ? 'is-active' : ''}" data-wish="${esc(p.id)}" aria-label="В обране">♥</button>
        </div>
        ${p.stock > 0 && p.stock <= 5 ? `<p class="muted small">Залишилось лише ${p.stock} шт.</p>` : ''}

        <div class="delivery-note">
          <span>🚚 Нова Пошта: 80 ₴, безкоштовно від 1500 ₴</span>
          <span>☕ Відправляємо протягом 1–2 днів після обсмаження</span>
          <span>💳 Оплата при отриманні або переказом</span>
        </div>

        <div><h2 class="panel__title" style="margin-bottom:8px">Опис</h2><p class="description">${esc(p.description)}</p></div>
      </div>
    </div>

    <section class="section" id="reviews">
      <div class="section__head"><h2 class="section__title">Відгуки</h2><span class="muted" id="reviews-summary"></span></div>
      <div id="review-form"></div>
      <div class="reviews" id="reviews-list" style="margin-top:16px"></div>
    </section>

    ${related.length ? `<section class="section"><div class="section__head"><h2 class="section__title">Вам також сподобається</h2></div>
      <div class="grid">${related.map(productCard).join('')}</div></section>` : ''}`;
  bind();
  loadReviews();
}

function currentPrice() {
  return product.variants.find((v) => v.id === choice.variantId).price;
}

function bind() {
  $root.querySelectorAll('[data-group]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      group.querySelectorAll('.pill').forEach((b) => b.classList.toggle('is-active', b === pill));
      if (group.dataset.group === 'variant') choice.variantId = pill.dataset.value;
      else choice.grind = pill.dataset.value;
      document.getElementById('price').textContent = money(currentPrice() * choice.qty);
    });
  });
  const qty = document.getElementById('qty');
  const setQty = (n) => {
    choice.qty = Math.max(1, Math.min(20, n || 1));
    qty.value = choice.qty;
    document.getElementById('price').textContent = money(currentPrice() * choice.qty);
  };
  $root.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => setQty(choice.qty + Number(b.dataset.qty))));
  qty.addEventListener('change', () => setQty(Number(qty.value)));
  document.getElementById('add').addEventListener('click', () => {
    Cart.add({ productId: product.id, variantId: choice.variantId, grind: choice.grind, qty: choice.qty });
    const icon = document.querySelector('.cart-btn');
    icon?.classList.remove('bump'); void icon?.offsetWidth; icon?.classList.add('bump');
    toast(`${product.name} — у кошику`, 'info', { href: 'cart.html', label: 'Оформити' });
  });
}

/* ---------- Відгуки ---------- */
async function loadReviews() {
  const list = document.getElementById('reviews-list');
  try {
    const { items } = await api('/reviews/' + productId);
    document.getElementById('reviews-summary').textContent = items.length
      ? `${(items.reduce((s, r) => s + r.rating, 0) / items.length).toFixed(1)} ★ · ${items.length} відгуків` : '';
    list.innerHTML = items.length ? items.map((r) => `
      <article class="review">
        <header><b>${esc(r.username)}</b><span class="rating">${stars(r.rating)}</span>
          ${r.verified ? '<span class="chip chip--green">✓ Покупка підтверджена</span>' : ''}
          <span class="muted small">${new Date(r.createdAt).toLocaleDateString('uk-UA')}</span></header>
        <p>${esc(r.text)}</p>
      </article>`).join('') : '<p class="notice">Відгуків ще немає — будь першим!</p>';
    renderReviewForm(items.find((r) => r.mine));
  } catch (err) { errorBox(list, err.message, loadReviews); }
}

function renderReviewForm(mine) {
  const box = document.getElementById('review-form');
  if (!App.user) { box.innerHTML = `<p class="muted"><a class="link" href="${loginUrl()}">Увійди</a>, щоб залишити відгук.</p>`; return; }
  box.innerHTML = `
    <form class="review-form">
      <b>${mine ? 'Оновити свій відгук' : 'Ваш відгук'}</b>
      <div class="stars-input">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" id="s${n}" value="${n}" ${(mine?.rating || 5) === n ? 'checked' : ''}><label for="s${n}" title="${n}">★</label>`).join('')}</div>
      <textarea class="field" name="text" rows="3" maxlength="1500" required minlength="3" placeholder="Як вам смак? Як заварювали?">${esc(mine?.text || '')}</textarea>
      <button class="btn btn--small">Надіслати</button>
    </form>`;
  box.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/reviews/' + productId, { method: 'POST', body: { rating: Number(f.rating.value), text: f.text.value } });
      toast('Дякуємо за відгук!');
      loadReviews();
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function init() {
  if (!productId) { location.href = 'catalog.html'; return; }
  try {
    const { product: p, related } = await api('/products/' + encodeURIComponent(productId));
    render(p, related);
  } catch (err) {
    $root.innerHTML = '';
    errorBox($root, err.status === 404 ? 'Такого товару немає' : err.message, init);
  }
}

document.addEventListener('wishchange', () => {
  document.querySelector('.wish-big')?.classList.toggle('is-active', App.wish.has(productId));
});
App.ready.then(init);
