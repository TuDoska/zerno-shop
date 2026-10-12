// Вхід і реєстрація
const next = new URLSearchParams(location.search).get('next') || 'account.html';
const safeNext = /^[\w./?=&%#-]*$/.test(next) && !next.startsWith('//') ? next : 'account.html';
const form = document.getElementById('auth-form');
const errorEl = document.getElementById('auth-error');
let mode = location.hash === '#register' ? 'register' : 'login';

function setMode(m) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === m));
  form.querySelector('button').textContent = m === 'login' ? 'Увійти' : 'Створити акаунт';
  form.password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
  document.querySelectorAll('.hint').forEach((h) => { h.hidden = m === 'login'; });
  errorEl.textContent = '';
}

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = form.querySelector('button');
  btn.disabled = true;
  errorEl.textContent = '';
  try {
    await api('/auth/' + mode, { method: 'POST', body: { username: form.username.value.trim(), password: form.password.value } });
    location.href = safeNext;
  } catch (err) {
    errorEl.textContent = err.code === 'too_many' ? 'Забагато спроб. Спробуй пізніше.' : err.message;
    btn.disabled = false;
  }
});

App.ready.then(() => {
  if (App.user) location.href = safeNext;
  setMode(mode);
});
