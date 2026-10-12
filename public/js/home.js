// Головна
async function loadCategories() {
  const box = document.getElementById('cats');
  try {
    const { categories } = await api('/meta');
    const art = { coffee: 'ethiopia-guji', tea: 'milk-oolong', accessories: 'hand-grinder', sets: 'set-tasting' };
    box.innerHTML = categories.map((c) => `
      <a class="cat" href="catalog.html?category=${c.id}">
        <img src="img/products/${art[c.id]}.svg" alt="" loading="lazy">
        <h3>${esc(c.label)}</h3>
        <p>${c.count} товарів →</p>
      </a>`).join('');
  } catch { box.innerHTML = ''; }
}

async function loadBestsellers() {
  const grid = document.getElementById('bestsellers');
  grid.innerHTML = skeletons(4);
  try {
    const { items } = await api('/products?sort=popular&limit=8');
    grid.innerHTML = items.map(productCard).join('');
  } catch (err) { errorBox(grid, err.message, loadBestsellers); }
}

async function loadNew() {
  const grid = document.getElementById('new-arrivals');
  try {
    const { items } = await api('/products?category=coffee&sort=new&limit=4');
    grid.innerHTML = items.map(productCard).join('');
  } catch { grid.innerHTML = ''; }
}

// Скопіювати промокод
document.addEventListener('click', async (e) => {
  const code = e.target.closest('[data-copy]');
  if (!code) return;
  try { await navigator.clipboard.writeText(code.dataset.copy); toast(`Промокод ${code.dataset.copy} скопійовано`); } catch { /* ignore */ }
});

App.ready.then(() => { loadCategories(); loadBestsellers(); loadNew(); });
document.addEventListener('wishchange', () => {});
