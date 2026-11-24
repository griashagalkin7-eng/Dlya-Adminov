const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initialState, applyCommand, total, priceAfterDiscount } = require('../electron/domain.cjs');
const change = (s,type,payload) => applyCommand(s,{type,payload});
function fixture() {
  let s = change(initialState(),'catalogSave',{catalog:'products',name:'Вода',price:105});
  s = change(s,'discount',{discount:10});
  s = change(s,'start',{date:'2026-11-19',period:'night'});
  return { s, productId:s.products[0].id, shiftId:s.shifts[0].id };
}
test('discount rounds per unit, repeats merge, changed prices retain separate snapshots', () => {
  let {s,productId,shiftId} = fixture();
  s = change(s,'addProduct',{paymentMethod:'cash',shiftId,productId,quantity:2});
  s = change(s,'addProduct',{paymentMethod:'cash',shiftId,productId,quantity:1});
  assert.equal(s.shifts[0].items.length,1);
  assert.equal(s.shifts[0].items[0].quantity,3);
  assert.equal(total(s.shifts[0]),285);
  s = change(s,'catalogSave',{catalog:'products',id:productId,name:'Вода',price:200});
  s = change(s,'addProduct',{paymentMethod:'cash',shiftId,productId,quantity:1});
  assert.equal(s.shifts[0].items.length,2);
  assert.equal(total(s.shifts[0]),465);
  s = change(s,'catalogDelete',{catalog:'products',id:productId});
  assert.equal(total(s.shifts[0]),465);
  assert.equal(s.shifts[0].items[0].name,'Вода');
});
test('PS discount toggles from base amount, never compounds, snapshots original rate', () => {
  let {s,shiftId} = fixture();
  s = change(s,'addService',{paymentMethod:'cash',shiftId,name:'ТВ3 1,5 часа',price:500,discount:true});
  const itemId = s.shifts[0].items[0].id;
  s = change(s,'discount',{discount:20});
  s = change(s,'editItem',{shiftId,itemId,name:'ТВ3 1,5 часа',price:500,discount:true});
  assert.equal(total(s.shifts[0]),450);
  s = change(s,'editItem',{shiftId,itemId,name:'ТВ3 1,5 часа',price:500,discount:false});
  assert.equal(total(s.shifts[0]),500);
  s = change(s,'editItem',{shiftId,itemId,name:'ТВ3 1,5 часа',price:500,discount:true});
  assert.equal(total(s.shifts[0]),400);
  s = change(s,'editItem',{shiftId,itemId,name:'ТВ3 1,5 часа',price:500,discount:true});
  assert.equal(total(s.shifts[0]),400);
  assert.equal(s.services.length,0);
});
test('only one active shift; completed shifts can be edited, deleted and duplicated by date', () => {
  let {s,shiftId} = fixture();
  assert.throws(() => change(s,'start',{date:'2026-11-19',period:'day'}),/Сначала завершите/);
  assert.throws(() => change(s,'deleteShift',{shiftId}),/сначала нужно завершить/);
  s = change(s,'finish',{shiftId});
  s = change(s,'start',{date:'2026-11-19',period:'night'});
  s = change(s,'addService',{paymentMethod:'cash',shiftId,name:'Исправление',price:300,discount:false});
  assert.equal(total(s.shifts.find(i => i.status === 'closed')),300);
  s = change(s,'deleteShift',{shiftId});
  assert.equal(s.shifts.length,1);
});
test('invalid money, quantities, discounts and dates are rejected without mutations', () => {
  const {s,productId,shiftId} = fixture();
  const before = structuredClone(s);
  for (const quantity of [-1,0,0.5,NaN,Infinity,100001]) assert.throws(() => change(s,'addProduct',{paymentMethod:'cash',shiftId,productId,quantity}));
  for (const discount of [-1,101,2.5,NaN]) assert.throws(() => change(s,'discount',{discount}));
  for (const value of ['2026-02-30','bad','2026-13-01','2025-02-29']) assert.throws(() => change(s,'shiftMeta',{shiftId,date:value,period:'day'}));
  assert.throws(() => change(s,'addService',{paymentMethod:'cash',shiftId,name:' ',price:1,discount:false}));
  assert.throws(() => change(s,'addService',{paymentMethod:'cash',shiftId,name:'ТВ',price:1.5,discount:false}));
  assert.deepEqual(s,before);
  assert.equal(priceAfterDiscount(105,10),95);
  assert.equal(priceAfterDiscount(105,100),0);
});
