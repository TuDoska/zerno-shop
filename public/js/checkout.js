// Оформлення замовлення
const $root = document.getElementById('checkout');
const getPromo = () => { try { return localStorage.getItem('zerno-promo') || ''; } catch { return ''; } };
let meta = null;
let quote = null;

const FIELD_MSG = { required: 'Заповни це поле', invalid: 'Перевір формат' };

function shell() {
  const u = App.user;
  $root.innerHTML = `
    <div class="cart-layout">
      <form class="checkout" id="form" novalidate>
        <fieldset>
          <legend>1. Контакти</legend>
          ${!u ? `<p class="small muted">Вже купували? <a class="link" href="${loginUrl()}">Увійди</a>, щоб бачити замовлення в кабінеті.</p>` : ''}
          <label class="label">Імʼя та прізвище<input class="field" name="name" autocomplete="name" required><span class="error" data-error="name"></span></label>
          <div class="form-row">
            <label class="label">Телефон<input class="field" name="phone" type="tel" autocomplete="tel" placeholder="+380 __ ___ __ __" required><span class="error" data-error="phone"></span></label>
            <label class="label">Email (необовʼязково)<input class="field" name="email" type="email" autocomplete="email"><span class="error" data-error="email"></span></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>2. Доставка</legend>
          <div class="choice-list">
            ${meta.delivery.map((d, i) => `
              <label class="choice"><input type="radio" name="delivery" value="${d.id}" ${i === 0 ? 'checked' : ''}>
                <b>${esc(d.label)}</b><span class="muted small">${d.price ? `${money(d.price)}${d.freeFrom ? `, від ${money(d.freeFrom)} — 0 ₴` : ''}` : 'безкоштовно'}</span></label>`).join('')}
          </div>
          <div class="form-row" id="address">
            <label class="label">Місто<input class="field" name="city" autocomplete="address-level2"><span class="error" data-error="city"></span></label>
            <label class="label"><span id="branch-label">Відділення Нової Пошти</span><input class="field" name="branch" placeholder="Напр.: №12"><span class="error" data-error="branch"></span></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>3. Оплата</legend>
          <div class="choice-list">
            ${meta.payments.map((p, i) => `<label class="choice"><input type="radio" name="payment" value="${p.id}" ${i === 0 ? 'checked' : ''}><b>${esc(p.label)}</b></label>`).join('')}
          </div>
          <p class="demo-note">Це демонстраційний магазин: гроші ніде не списуються, а дані карток ми не запитуємо.</p>
          <label class="label">Коментар до замовлення<textarea class="field" name="comment" rows="2" maxlength="500"></textarea></label>
        </fieldset>
      </form>

      <aside class="panel summary" id="summary"></aside>
    </div>`;

  const form = document.getElementById('form');
  if (u) form.name.value = '';
  form.addEventListener('change', (e) => {
    if (e.target.name === 'delivery') { toggleAddress(); renderSummary(); }
  });
  toggleAddress();
}

function toggleAddress() {
  const form = document.getElementById('form');
  const method = form.delivery.value;
  document.getElementById('address').hidden = method === 'pickup';
  document.getElementById('branch-label').textContent = method === 'nova_courier' ? 'Адреса (вулиця, будинок, квартира)' : 'Відділення Нової Пошти';
}

async function renderSummary() {
  const box = document.getElementById('summary');
  const form = document.getElementById('form');
  try {
    quote = await api('/cart/quote', { method: 'POST', body: { items: Cart.get(), promo: getPromo(), delivery: form.delivery.value } });
  } catch (err) { errorBox(box, err.message, renderSummary); return; }
  box.innerHTML = `
    <h2 class="panel__title">Ваше замовлення</h2>
    <div class="mini-lines">
      ${quote.lines.map((l) => `
        <div class="mini-line"><img src="${esc(l.image)}" alt="">
          <div><b>${esc(l.name)}</b><div class="muted small">${esc(l.variantLabel)}${l.grind ? ' · ' + esc(l.grind) : ''} × ${l.qty}</div></div>
          <span class="price">${money(l.total)}</span></div>`).join('')}
    </div>
    <div class="summary__row"><span>Товари</span><span>${money(quote.subtotal)}</span></div>
    ${quote.discount ? `<div class="summary__row"><span>Промокод ${esc(quote.promo.code)}</span><span class="discount">−${money(quote.discount)}</span></div>` : ''}
    <div class="summary__row"><span>Доставка</span><span>${quote.delivery.price ? money(quote.delivery.price) : 'безкоштовно'}</span></div>
    <div class="summary__row summary__row--total"><span>До сплати</span><span>${money(quote.total)}</span></div>
    <button class="btn btn--accent btn--block" id="submit" form="form">Підтвердити замовлення</button>
    <p class="muted small">Натискаючи кнопку, ви погоджуєтеся, що це тестове замовлення в демо-магазині.</p>`;
}

async function submit(e) {
  e.preventDefault();
  const form = document.getElementById('form');
  form.querySelectorAll('[data-error]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  const btn = document.getElementById('submit');
  btn.disabled = true;
  btn.textContent = 'Оформлюємо…';
  try {
    const res = await api('/orders', {
      method: 'POST',
      body: {
        items: Cart.get(),
        promo: getPromo(),
        customer: { name: form.name.value, phone: form.phone.value, email: form.email.value },
        delivery: { method: form.delivery.value, city: form.city.value, branch: form.branch.value },
        payment: form.payment.value,
        comment: form.comment.value,
      },
    });
    Cart.clear();
    try { localStorage.removeItem('zerno-promo'); } catch { /* ignore */ }
    location.href = `order.html?n=${res.number}&t=${res.token}&new=1`;
  } catch (err) {
    if (err.code === 'validation') {
      Object.entries(err.data.fields).forEach(([name, code]) => {
        const el = form.querySelector(`[data-error="${name}"]`);
        if (el) el.textContent = FIELD_MSG[code] || FIELD_MSG.required;
        form.elements[name]?.classList?.add('is-invalid');
      });
      form.querySelector('.is-invalid')?.focus();
      toast('Перевір виділені поля', 'error');
    } else {
      toast(err.message, 'error');
      if (err.code === 'cart_changed') renderSummary();
    }
    btn.disabled = false;
    btn.textContent = 'Підтвердити замовлення';
  }
}

App.ready.then(async () => {
  if (!Cart.get().length) { location.href = 'cart.html'; return; }
  try { meta = await api('/meta'); } catch (err) { errorBox($root, err.message, () => location.reload()); return; }
  shell();
  document.getElementById('form').addEventListener('submit', submit);
  renderSummary();
});
