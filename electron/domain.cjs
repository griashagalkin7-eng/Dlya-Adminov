const { randomUUID } = require('node:crypto');
const MAX = 1_000_000_000;
const fail = (text) => { throw new Error(text); };
function text(value, label = 'Название') {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 180) fail(`${label}: введите от 1 до 180 символов.`);
  return value.trim();
}
function number(value, min, max, label, integer = true) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`${label}: недопустимое значение.`);
  return value;
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '9999-12-31') fail('Укажите корректную дату.');
  return value;
}
const period = (v) => ['day', 'night'].includes(v) ? v : fail('Выберите день или ночь.');
const priceAfterDiscount = (price, discount) => Math.round(price * (100 - discount) / 100);
const total = (shift, kind) => shift.items.filter(i => !kind || i.kind === kind).reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
function initialState() {
  return { schemaVersion: 1, revision: 0, settings: { discount: 0, theme: 'light' }, products: [], services: [], shifts: [] };
}
function getShift(state, id) {
  return state.shifts.find(s => s.id === id) || fail('Учёт не найден.');
}
function applyCommand(previous, command) {
  const state = structuredClone(previous);
  const { type, payload: p = {} } = command;
  switch (type) {
    case 'theme':
      if (!['light', 'dark'].includes(p.theme)) fail('Неизвестная тема.');
      state.settings.theme = p.theme;
      break;
    case 'discount':
      state.settings.discount = number(p.discount, 0, 100, 'Скидка');
      break;
    case 'catalogSave': {
      if (!['products', 'services'].includes(p.catalog)) fail('Неизвестный список.');
      const list = state[p.catalog];
      const name = text(p.name);
      if (list.some(i => i.id !== p.id && i.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) fail('Такое название уже есть в списке.');
      const item = { id: p.id || randomUUID(), name };
      if (p.catalog === 'products') item.price = number(p.price, 0, MAX, 'Цена');
      if (p.id) {
        const index = list.findIndex(i => i.id === p.id);
        if (index === -1) fail('Позиция не найдена.');
        list[index] = item;
      } else list.push(item);
      break;
    }
    case 'catalogDelete':
      if (!['products', 'services'].includes(p.catalog)) fail('Неизвестный список.');
      state[p.catalog] = state[p.catalog].filter(i => i.id !== p.id);
      break;
    case 'start':
      if (state.shifts.some(s => s.status === 'active')) fail('Сначала завершите текущий учёт.');
      state.shifts.push({ id: randomUUID(), date: date(p.date), period: period(p.period), status: 'active', createdAt: new Date().toISOString(), closedAt: null, items: [] });
      break;
    case 'shiftMeta': {
      const shift = getShift(state, p.shiftId);
      shift.date = date(p.date);
      shift.period = period(p.period);
      break;
    }
    case 'addProduct': {
      const shift = getShift(state, p.shiftId);
      const product = state.products.find(i => i.id === p.productId) || fail('Выберите товар из списка.');
      const quantity = number(p.quantity, 1, 100000, 'Количество');
      const discount = state.settings.discount;
      const unitPrice = priceAfterDiscount(product.price, discount);
      const existing = shift.items.find(i => i.kind === 'product' && i.productId === product.id && i.name === product.name && i.basePrice === product.price && i.discountPercent === discount);
      if (existing) existing.quantity = number(existing.quantity + quantity, 1, 100000, 'Количество');
      else shift.items.push({ id: randomUUID(), kind: 'product', productId: product.id, name: product.name, quantity, basePrice: product.price, discountPercent: discount, unitPrice });
      break;
    }
    case 'addService': {
      const shift = getShift(state, p.shiftId);
      const basePrice = number(p.price, 0, MAX, 'Цена');
      const discount = p.discount ? state.settings.discount : 0;
      shift.items.push({ id: randomUUID(), kind: 'service', name: text(p.name), quantity: 1, basePrice, discountPercent: discount, unitPrice: priceAfterDiscount(basePrice, discount) });
      break;
    }
    case 'addPc': {
      const shift = getShift(state, p.shiftId);
      const price = number(p.price, 0, MAX, 'Сумма');
      shift.items.push({ id: randomUUID(), kind: 'pc', name: 'ПК', quantity: 1, basePrice: price, discountPercent: 0, unitPrice: price });
      break;
    }
    case 'editItem': {
      const item = getShift(state, p.shiftId).items.find(i => i.id === p.itemId) || fail('Позиция не найдена.');
      if (item.kind === 'product') item.quantity = number(p.quantity, 1, 100000, 'Количество');
      else if (item.kind === 'pc') {
        item.basePrice = number(p.price, 0, MAX, 'Сумма');
        item.unitPrice = item.basePrice;
        item.discountPercent = 0;
      }
      else {
        item.name = text(p.name);
        item.basePrice = number(p.price, 0, MAX, 'Цена');
        // Existing discounts keep their original rate after settings are changed.
        item.discountPercent = p.discount ? (item.discountPercent || state.settings.discount) : 0;
        item.unitPrice = priceAfterDiscount(item.basePrice, item.discountPercent);
      }
      break;
    }
    case 'deleteItem': {
      const shift = getShift(state, p.shiftId);
      shift.items = shift.items.filter(i => i.id !== p.itemId);
      break;
    }
    case 'finish': {
      const shift = getShift(state, p.shiftId);
      if (shift.status !== 'active') fail('Учёт уже завершён.');
      shift.status = 'closed';
      shift.closedAt = new Date().toISOString();
      break;
    }
    case 'deleteShift': {
      if (getShift(state, p.shiftId).status !== 'closed') fail('Активный учёт сначала нужно завершить.');
      state.shifts = state.shifts.filter(s => s.id !== p.shiftId);
      break;
    }
    default: fail('Неизвестное действие.');
  }
  state.revision++;
  validateState(state);
  return state;
}
function validateState(state) {
  if (!state || state.schemaVersion !== 1 || !Array.isArray(state.shifts) || !Array.isArray(state.products) || !Array.isArray(state.services)) fail('Неподдерживаемый формат данных.');
  number(state.revision, 0, Number.MAX_SAFE_INTEGER, 'Версия данных');
  number(state.settings.discount, 0, 100, 'Скидка');
  if (!['light', 'dark'].includes(state.settings.theme)) fail('Ошибка темы.');
  const ids = new Set();
  const id = (v) => { text(v, 'Идентификатор'); if (ids.has(v)) fail('Повторяющийся идентификатор.'); ids.add(v); };
  for (const p of state.products) { id(p.id); text(p.name); number(p.price, 0, MAX, 'Цена'); }
  for (const s of state.services) { id(s.id); text(s.name); }
  if (state.shifts.filter(s => s.status === 'active').length > 1) fail('В данных больше одного активного учёта.');
  for (const s of state.shifts) {
    id(s.id); date(s.date); period(s.period);
    if (!['active', 'closed'].includes(s.status) || !Array.isArray(s.items)) fail('Некорректный учёт.');
    for (const i of s.items) {
      id(i.id); text(i.name);
      if (!['product', 'service', 'pc'].includes(i.kind)) fail('Неизвестный тип позиции.');
      number(i.quantity, 1, 100000, 'Количество'); number(i.basePrice, 0, MAX, 'Цена'); number(i.discountPercent, 0, 100, 'Скидка');
      if (i.unitPrice !== priceAfterDiscount(i.basePrice, i.discountPercent)) fail('Некорректная цена позиции.');
      if (i.kind === 'pc' && (i.discountPercent !== 0 || i.quantity !== 1 || i.name !== 'ПК')) fail('Некорректная запись ПК.');
    }
    if (!Number.isSafeInteger(total(s))) fail('Слишком большая сумма учёта.');
  }
  return state;
}
module.exports = { initialState, applyCommand, validateState, priceAfterDiscount, total, getShift };
