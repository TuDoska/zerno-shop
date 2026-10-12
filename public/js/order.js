// Сторінка замовлення (після оформлення і з кабінету)
const params = new URLSearchParams(location.search);
const $root = document.getElementById('order');
const STATUS = { new: 'Нове', confirmed: 'Підтверджено', shipped: 'Відправлено', delivered: 'Отримано', cancelled: 'Скасовано' };
const STEPS = ['new', 'confirmed', 'shipped', 'delivered'];

function render(o) {
  document.title = `Замовлення №${o.number} — Зерно`;
  const stepIndex = STEPS.indexOf(o.status);
  $root.innerHTML = `
    ${params.get('new') ? `
      <div class="success">
        <div class="success__icon">✓</div>
        <h1 class="page__title">Дякуємо за замовлення!</h1>
        <p class="muted">Номер замовлення <b>№${o.number}</b>. Ми звʼяжемося з вами за номером ${esc(o.customer.phone)}.</p>
      </div>` : `<h1 class="page__title">Замовлення №${o.number}</h1>`}

    <div class="cart-layout">
      <div style="display:grid;gap:18px">
        <section class="panel">
          <div class="section__head" style="margin-bottom:12px"><h2 class="panel__title" style="margin:0">Статус</h2>
            <span class="status status--${o.status}">${STATUS[o.status]}</span></div>
          ${o.status === 'cancelled' ? '<p class="muted">Замовлення скасовано.</p>' : `
            <div class="timeline">${STEPS.map((s, i) => `<div class="${i <= stepIndex ? 'is-done' : ''}">${STATUS[s]}</div>`).join('')}</div>`}
          <p class="muted small">Оформлено ${fmtDate(o.createdAt)}</p>
        </section>
        <section class="panel">
          <h2 class="panel__title">Товари</h2>
          <div class="mini-lines" style="max-height:none">
            ${o.lines.map((l) => `
              <div class="mini-line"><img src="${esc(l.image)}" alt="">
                <div><a href="product.html?id=${encodeURIComponent(l.productId)}"><b>${esc(l.name)}</b></a>
                <div class="muted small">${esc(l.variantLabel)}${l.grind ? ' · ' + esc(l.grind) : ''} × ${l.qty}</div></div>
                <span class="price">${money(l.total)}</span></div>`).join('')}
          </div>
        </section>
      </div>
      <aside class="panel summary">
        <h2 class="panel__title">Деталі</h2>
        <p><b>${esc(o.customer.name)}</b><br><span class="muted">${esc(o.customer.phone)}${o.customer.email ? ' · ' + esc(o.customer.email) : ''}</span></p>
        <p><b>${esc(o.delivery.label)}</b><br><span class="muted">${esc([o.delivery.city, o.delivery.branch].filter(Boolean).join(', ') || 'Львів, вул. Кавова, 1')}</span></p>
        <p><b>${esc(o.paymentLabel)}</b></p>
        ${o.comment ? `<p class="muted small">💬 ${esc(o.comment)}</p>` : ''}
        <div class="summary__row"><span>Товари</span><span>${money(o.subtotal)}</span></div>
        ${o.discount ? `<div class="summary__row"><span>Знижка ${esc(o.promo || '')}</span><span class="discount">−${money(o.discount)}</span></div>` : ''}
        <div class="summary__row"><span>Доставка</span><span>${o.delivery.price ? money(o.delivery.price) : 'безкоштовно'}</span></div>
        <div class="summary__row summary__row--total"><span>Разом</span><span>${money(o.total)}</span></div>
        <a class="btn btn--ghost btn--block" href="catalog.html">Продовжити покупки</a>
      </aside>
    </div>`;
}

App.ready.then(async () => {
  try {
    const { order } = await api(`/orders/${encodeURIComponent(params.get('n'))}?token=${encodeURIComponent(params.get('t') || '')}`);
    render(order);
  } catch (err) {
    errorBox($root, err.status === 404 ? 'Замовлення не знайдено' : err.message);
  }
});
