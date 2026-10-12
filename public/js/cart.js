// Кошик: ціни завжди рахує сервер
const $root = document.getElementById('cart');
const PROMO_KEY = 'zerno-promo';
const getPromo = () => { try { return localStorage.getItem(PROMO_KEY) || ''; } catch { return ''; } };
const setPromo = (v) => { try { v ? localStorage.setItem(PROMO_KEY, v) : localStorage.removeItem(PROMO_KEY); } catch { /* ignore */ } };

const EMPTY = `
  <div class="empty-cart">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5 7h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>
    <h2 class="section__title">Кошик порожній</h2>
    <p class="muted">Час обрати каву на цей тиждень.</p>
    <a class="btn btn--accent" href="catalog.html">До каталогу</a>
  </div>`;

function promoMessage(errors) {
  const e = errors.find((x) => x.error.startsWith('promo'));
  if (!e) return '';
  return e.error === 'promo_min' ? `Промокод діє від ${money(e.minTotal)}` : 'Такого промокоду немає';
}

async function render() {
  const items = Cart.get();
  if (!items.length) { $root.innerHTML = EMPTY; return; }
  let q;
  try {
    q = await api('/cart/quote', { method: 'POST', body: { items, promo: getPromo(), delivery: 'nova_branch' } });
  } catch (err) { errorBox($root, err.message, render); return; }

  // Прибираємо з кошика товари, яких більше немає
  const missing = q.errors.filter((e) => e.error === 'not_found' || e.error === 'out_of_stock').map((e) => e.productId);
  if (missing.length) {
    Cart.save(items.filter((i) => !missing.includes(i.productId)));
    toast('Деяких товарів уже немає — ми прибрали їх з кошика', 'error');
    return render();
  }

  const freeFrom = q.delivery.freeFrom;
  const left = Math.max(0, freeFrom - (q.subtotal - q.discount));
  const promoErr = promoMessage(q.errors);

  $root.innerHTML = `
    <div class="cart-layout">
      <div class="cart-list">
        ${q.lines.map((l) => {
          const key = Cart.key(l);
          return `
          <article class="cart-item" data-key="${esc(key)}">
            <a href="product.html?id=${encodeURIComponent(l.productId)}"><img src="${esc(l.image)}" alt=""></a>
            <div>
              <a class="cart-item__title" href="product.html?id=${encodeURIComponent(l.productId)}">${esc(l.name)}</a>
              <p class="muted small">${esc(l.variantLabel)}${l.grind ? ' · ' + esc(l.grind) : ''} · ${money(l.price)}</p>
              <div class="cart-item__controls">
                <div class="qty qty--small"><button data-step="-1" aria-label="Менше">−</button><input value="${l.qty}" type="number" min="1" max="20" aria-label="Кількість"><button data-step="1" aria-label="Більше">+</button></div>
                <button class="remove" data-remove>Видалити</button>
              </div>
            </div>
            <div class="cart-item__total"><span class="price">${money(l.total)}</span></div>
          </article>`;
        }).join('')}
      </div>

      <aside class="panel summary">
        <h2 class="panel__title">Разом</h2>
        <div class="free-ship">
          ${left > 0 ? `До безкоштовної доставки: ${money(left)}` : '🎉 Доставка безкоштовна'}
          <div class="bar"><i style="width:${Math.min(100, ((q.subtotal - q.discount) / freeFrom) * 100)}%"></i></div>
        </div>
        <div class="summary__row"><span>Товари (${q.lines.reduce((s, l) => s + l.qty, 0)})</span><span>${money(q.subtotal)}</span></div>
        ${q.discount ? `<div class="summary__row"><span>Промокод ${esc(q.promo.code)}</span><span class="discount">−${money(q.discount)}</span></div>` : ''}
        <div class="summary__row"><span>Доставка</span><span>${q.delivery.price ? money(q.delivery.price) : 'безкоштовно'}</span></div>
        <div class="summary__row summary__row--total"><span>До сплати</span><span>${money(q.total)}</span></div>
        <form class="promo-form" id="promo-form">
          <input class="field" name="code" placeholder="Промокод" value="${esc(getPromo())}" aria-label="Промокод">
          <button class="btn btn--ghost btn--small">${getPromo() && !promoErr ? 'Змінити' : 'Застосувати'}</button>
        </form>
        ${promoErr ? `<p class="small" style="color:var(--danger);font-weight:700">${esc(promoErr)}</p>` : ''}
        <a class="btn btn--accent btn--block" href="checkout.html">Оформити замовлення</a>
        <a class="link small" href="catalog.html" style="text-align:center">← Продовжити покупки</a>
      </aside>
    </div>`;
}

$root.addEventListener('click', (e) => {
  const item = e.target.closest('[data-key]');
  if (!item) return;
  const key = item.dataset.key;
  if (e.target.closest('[data-remove]')) { Cart.remove(key); render(); return; }
  const step = e.target.closest('[data-step]');
  if (step) {
    const input = item.querySelector('input');
    Cart.setQty(key, Number(input.value) + Number(step.dataset.step));
    render();
  }
});
$root.addEventListener('change', (e) => {
  const item = e.target.closest('[data-key]');
  if (item && e.target.matches('input')) { Cart.setQty(item.dataset.key, Number(e.target.value)); render(); }
});
$root.addEventListener('submit', (e) => {
  if (e.target.id !== 'promo-form') return;
  e.preventDefault();
  setPromo(e.target.code.value.trim().toUpperCase());
  render();
});

App.ready.then(render);
