// Спільні допоміжні функції

// Витягує 11-символьний id YouTube-відео з посилання або повертає null
function parseYouTubeId(input = '') {
  const value = String(input).trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1, 12);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);
      if (m) id = m[2];
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

// Обрізає й чистить текст від керівних символів
function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

const isValidAnimeId = (id) => Number.isInteger(id) && id > 0 && id < 10_000_000;

// Обгортка для async-маршрутів, щоб помилки йшли в обробник помилок
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Короткий код кімнати (без схожих символів)
function roomCode(len = 6) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = require('crypto').randomBytes(len);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

module.exports = { parseYouTubeId, cleanText, isValidAnimeId, ah, roomCode };
