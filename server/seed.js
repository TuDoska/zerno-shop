// Стартові товари та промокоди (додаються, лише якщо база порожня)
const { db } = require('./db');

const COFFEE_GRIND = ['У зернах', 'Під еспресо', 'Під фільтр', 'Під турку'];

const coffee = (o) => ({
  category: 'coffee',
  options: { grind: COFFEE_GRIND },
  variants: [
    { id: '250', label: '250 г', price: o.price },
    { id: '1000', label: '1 кг', price: Math.round(o.price * 3.4 / 10) * 10 },
  ],
  ...o,
});

const tea = (o) => ({
  category: 'tea',
  variants: [
    { id: '50', label: '50 г', price: o.price },
    { id: '100', label: '100 г', price: Math.round(o.price * 1.8 / 5) * 5 },
  ],
  ...o,
});

const single = (o) => ({ variants: [{ id: 'one', label: '1 шт', price: o.price }], ...o });

const PRODUCTS = [
  coffee({ _id: 'ethiopia-guji', name: 'Ефіопія Гуджі', origin: 'Ефіопія', roast: 'light', process: 'Мита', price: 420, color: '#e9a23b', notes: ['жасмин', 'бергамот', 'персик'], short: 'Квіткова й соковита, ідеальна для фільтра.' }),
  coffee({ _id: 'kenya-nyeri', name: 'Кенія Ньєрі AA', origin: 'Кенія', roast: 'light', process: 'Мита', price: 480, color: '#c4453c', notes: ['чорна смородина', 'грейпфрут', 'тростинний цукор'], short: 'Яскрава ягідна кислотність і довгий післясмак.' }),
  coffee({ _id: 'colombia-huila', name: 'Колумбія Уїла', origin: 'Колумбія', roast: 'medium', process: 'Мита', price: 380, color: '#8c5a3c', notes: ['карамель', 'червоне яблуко', 'какао'], short: 'Збалансована кава на кожен день.' }),
  coffee({ _id: 'brazil-cerrado', name: 'Бразилія Серрадо', origin: 'Бразилія', roast: 'medium', process: 'Натуральна', price: 340, color: '#6b4a2e', notes: ['молочний шоколад', 'горіх', 'карамель'], short: 'Солодка й щільна, чудова з молоком.' }),
  coffee({ _id: 'guatemala-antigua', name: 'Гватемала Антигуа', origin: 'Гватемала', roast: 'medium', process: 'Мита', price: 395, color: '#a0603a', notes: ['темний шоколад', 'спеції', 'апельсин'], short: 'Шоколадна з легкою цитрусовою свіжістю.' }),
  coffee({ _id: 'costa-rica-tarrazu', name: 'Коста-Рика Таррасу', origin: 'Коста-Рика', roast: 'light', process: 'Хані', price: 450, color: '#d47a3a', notes: ['мед', 'абрикос', 'мигдаль'], short: 'Медова солодкість завдяки обробці хані.' }),
  coffee({ _id: 'rwanda-huye', name: 'Руанда Хує', origin: 'Руанда', roast: 'light', process: 'Мита', price: 465, color: '#b85a6a', notes: ['малина', 'чай з бергамотом', 'лайм'], short: 'Делікатна й чайна, для поціновувачів.' }),
  coffee({ _id: 'sumatra-mandheling', name: 'Суматра Мандхелінг', origin: 'Індонезія', roast: 'dark', process: 'Мокре лущення', price: 410, color: '#4a3a2e', notes: ['кедр', 'гіркий шоколад', 'тютюн'], short: 'Землиста й густа, з низькою кислотністю.' }),
  coffee({ _id: 'espresso-zerno', name: 'Еспресо-суміш «Зерно»', origin: 'Бразилія / Колумбія', roast: 'dark', process: 'Мікс', price: 320, color: '#3e2a20', notes: ['какао', 'фундук', 'карамель'], short: 'Наша фірмова суміш для еспресо та капучино.', badge: 'Хіт' }),
  coffee({ _id: 'decaf-mexico', name: 'Мексика Без кофеїну', origin: 'Мексика', roast: 'medium', process: 'Swiss Water', price: 390, color: '#7a6a4e', notes: ['ваніль', 'печиво', 'горіх'], short: 'Повний смак без кофеїну, навіть увечері.' }),

  tea({ _id: 'sencha', name: 'Сенча преміум', origin: 'Японія', price: 210, color: '#7fae4a', notes: ['свіжа трава', 'морський бриз'], short: 'Класичний японський зелений чай.' }),
  tea({ _id: 'assam', name: 'Ассам TGFOP', origin: 'Індія', price: 160, color: '#9a4a2a', notes: ['солод', 'мед'], short: 'Міцний чорний чай для бадьорого ранку.' }),
  tea({ _id: 'earl-grey', name: 'Ерл Грей', origin: 'Шрі-Ланка', price: 170, color: '#4a5a8a', notes: ['бергамот', 'цитрус'], short: 'Чорний чай з олією бергамоту.' }),
  tea({ _id: 'milk-oolong', name: 'Молочний улун', origin: 'Тайвань', price: 260, color: '#d8b46a', notes: ['вершки', 'квіти'], short: 'Ніжний улун з вершковим ароматом.' }),
  tea({ _id: 'herbal-carpathian', name: 'Карпатський збір', origin: 'Україна', price: 140, color: '#5a8a5a', notes: ['чебрець', 'м\'ята', 'липа'], short: 'Трав\'яний чай із карпатських трав.', badge: 'Україна' }),
  tea({ _id: 'rooibos', name: 'Ройбуш з апельсином', origin: 'ПАР', price: 150, color: '#c4602a', notes: ['апельсин', 'ваніль'], short: 'Без кофеїну, теплий і солодкуватий.' }),

  single({ _id: 'v60-dripper', name: 'Пуровер-воронка', category: 'accessories', price: 590, color: '#e8e2d6', short: 'Керамічна воронка для заварювання фільтр-кави.' }),
  single({ _id: 'hand-grinder', name: 'Ручна кавомолка', category: 'accessories', price: 1890, color: '#9aa0a6', short: 'Сталеві жорна, 30 ступенів помелу.', badge: 'Новинка' }),
  single({ _id: 'gooseneck-kettle', name: 'Чайник з гусячою шиєю', category: 'accessories', price: 1490, color: '#2e3a40', short: 'Точне виливання води для пуровера.' }),
  single({ _id: 'french-press', name: 'Френч-прес 600 мл', category: 'accessories', price: 750, color: '#c9d6d8', short: 'Скляна колба й сталевий фільтр.' }),
  single({ _id: 'ceramic-mug', name: 'Кухоль «Зерно»', category: 'accessories', price: 320, color: '#e2725b', short: 'Керамічний кухоль 300 мл ручної роботи.' }),
  single({ _id: 'paper-filters', name: 'Паперові фільтри (100 шт)', category: 'accessories', price: 180, color: '#f4efe6', short: 'Для воронки розміру 02.' }),

  single({ _id: 'set-tasting', name: 'Дегустаційний набір', category: 'sets', price: 990, color: '#b07a4a', short: '4 × 100 г кави з різних країн у подарунковій коробці.', badge: 'Подарунок' }),
  single({ _id: 'set-starter', name: 'Набір «Перший пуровер»', category: 'sets', price: 1450, color: '#7a5a3a', short: 'Воронка, фільтри та 250 г кави для старту.' }),
];

const ROAST_TEXT = { light: 'світле', medium: 'середнє', dark: 'темне' };

function describe(p) {
  if (p.category === 'coffee') {
    return `${p.name} — кава ${ROAST_TEXT[p.roast]} обсмаження з регіону ${p.origin}. Обробка: ${p.process.toLowerCase()}.\n\nУ чашці: ${p.notes.join(', ')}. Ми обсмажуємо невеликими партіями щотижня і відправляємо каву не пізніше ніж через 7 днів після обсмаження.\n\nРекомендовані способи заварювання: ${p.roast === 'dark' ? 'еспресо, мока, турка' : p.roast === 'light' ? 'пуровер, аеропрес, кемекс' : 'еспресо, фільтр, френч-прес'}.`;
  }
  if (p.category === 'tea') {
    return `${p.name} (${p.origin}). Смак і аромат: ${p.notes.join(', ')}.\n\nЗаварюйте 3–5 г на 250 мл води. Чай зберігається у щільно закритій упаковці подалі від світла.`;
  }
  return `${p.short}\n\nРечі, які ми обрали самі й використовуємо щодня в нашій кав'ярні.`;
}

async function seed() {
  if ((await db.products.count({})) === 0) {
    let order = 0;
    for (const p of PRODUCTS) {
      await db.products.insert({
        ...p,
        description: describe(p),
        image: `img/products/${p._id}.svg`,
        stock: 50,
        hidden: false,
        rating: null,
        ratingCount: 0,
        sales: 0,
        sort: order++,
        createdAt: new Date(Date.now() - (PRODUCTS.length - order) * 3600 * 1000),
      });
    }
    console.log(`☕ Додано ${PRODUCTS.length} товарів`);
  }
  if ((await db.promos.count({})) === 0) {
    await db.promos.insert({ _id: 'ZERNO10', type: 'percent', value: 10, minTotal: 0, active: true, uses: 0, createdAt: new Date() });
    await db.promos.insert({ _id: 'WELCOME', type: 'fixed', value: 100, minTotal: 800, active: true, uses: 0, createdAt: new Date() });
  }
}

module.exports = { seed, PRODUCTS };
