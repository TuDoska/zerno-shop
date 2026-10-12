// Каталог з фільтрами
const state = Object.fromEntries(['category', 'roast', 'min', 'max', 'sort', 'q'].map((k) => [k, new URLSearchParams(location.search).get(k) || '']));
const $grid = document.getElementById('grid');
const $count = document.getElementById('count');
const $title = document.getElementById('title');
const $cats = document.getElementById('f-cats');
const $roast = document.getElementById('f-roast');
const $filters = document.getElementById('filters');
let categories = [];

const ROASTS = [['', 'Будь-яке'], ['light', 'Світле'], ['medium', 'Середнє'], ['dark', 'Темне']];

function syncUrl() {
  const p = new URLSearchParams();
  Object.entries(state).forEach(([k, v]) => { if (v) p.set(k, v); });
  history.replaceState(null, '', 'catalog.html' + (p.toString() ? '?' + p : ''));
}

function renderFilters() {
  const total = categories.reduce((s, c) => s + c.count, 0);
  $cats.innerHTML = [{ id: '', label: 'Усі товари', count: total }, ...categories].map((c) => `
    <button data-cat="${c.id}" class="${state.category === c.id ? 'is-active' : ''}">${esc(c.label)} <span>${c.count}</span></button>`).join('');
  $roast.closest('section').hidden = state.category && state.category !== 'coffee';
  $roast.innerHTML = ROASTS.map(([v, l]) => `<button data-roast="${v}" class="${state.roast === v ? 'is-active' : ''}">${l}</button>`).join('');
  document.getElementById('f-min').value = state.min;
  document.getElementById('f-max').value = state.max;
  document.getElementById('sort').value = state.sort || 'popular';
  const cat = categories.find((c) => c.id === state.category);
  $title.textContent = state.q ? `Пошук: «${state.q}»` : cat ? cat.label : 'Каталог';
  document.title = `${$title.textContent} — Зерно`;
}

async function load() {
  syncUrl();
  renderFilters();
  $grid.innerHTML = skeletons(8);
  try {
    const params = new URLSearchParams(Object.entries(state).filter(([, v]) => v));
    const { items, total } = await api('/products?' + params);
    $count.textContent = `${total} ${total === 1 ? 'товар' : total >= 2 && total <= 4 ? 'товари' : 'товарів'}`;
    $grid.innerHTML = items.length ? items.map(productCard).join('')
      : '<div class="notice">Нічого не знайдено. <button class="link" id="reset">Скинути фільтри</button></div>';
  } catch (err) { errorBox($grid, err.message, load); }
}

$filters.addEventListener('click', (e) => {
  const cat = e.target.closest('[data-cat]');
  if (cat) { state.category = cat.dataset.cat; if (state.category !== 'coffee') state.roast = ''; load(); }
  const roast = e.target.closest('[data-roast]');
  if (roast) { state.roast = roast.dataset.roast; load(); }
});

document.getElementById('price-form').addEventListener('submit', (e) => {
  e.preventDefault();
  state.min = document.getElementById('f-min').value;
  state.max = document.getElementById('f-max').value;
  load();
});
document.getElementById('sort').addEventListener('change', (e) => { state.sort = e.target.value === 'popular' ? '' : e.target.value; load(); });
document.getElementById('toggle-filters').addEventListener('click', () => $filters.classList.toggle('is-open'));
document.addEventListener('click', (e) => {
  if (e.target.id === 'reset') { Object.keys(state).forEach((k) => { state[k] = ''; }); load(); }
});

App.ready.then(async () => {
  try { categories = (await api('/meta')).categories; } catch { /* фільтри без лічильників */ }
  const q = document.querySelector('.header__search input');
  if (q) q.value = state.q;
  load();
});
