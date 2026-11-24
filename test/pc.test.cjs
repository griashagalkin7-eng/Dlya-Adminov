const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initialState, applyCommand, total, validateState } = require('../electron/domain.cjs');
const change = (s,type,payload) => applyCommand(s,{type,payload});
test('PC only accepts an amount, never discounts it, and keeps payments separate', () => {
  let s = change(initialState(),'discount',{discount:100});
  s = change(s,'start',{date:'2026-11-21',period:'day'});
  const shiftId = s.shifts[0].id;
  for (let n=0;n<2;n++) s = change(s,'addPc',{paymentMethod:'cash',shiftId,price:500,discount:true,name:'ignored'});
  assert.equal(s.shifts[0].items.length,2);
  assert.equal(total(s.shifts[0],'pc'),1000);
  for (const item of s.shifts[0].items) {
    assert.equal(item.name,'ПК'); assert.equal(item.quantity,1); assert.equal(item.discountPercent,0);
  }
  const itemId = s.shifts[0].items[0].id;
  s = change(s,'editItem',{shiftId,itemId,price:350,discount:true,quantity:99,name:'ignored'});
  assert.equal(total(s.shifts[0]),850);
  assert.equal(s.shifts[0].items[0].quantity,1);
  s = change(s,'finish',{shiftId});
  s = change(s,'deleteItem',{shiftId,itemId});
  assert.equal(total(s.shifts[0],'pc'),500);
  assert.equal(total(s.shifts[0],'service'),0);
});
test('invalid PC amounts and tampered PC records are rejected', () => {
  let s = change(initialState(),'start',{date:'2026-11-21',period:'night'});
  const shiftId = s.shifts[0].id;
  for (const price of [-1,0.5,NaN,Infinity,1000000001,'500',undefined]) assert.throws(() => change(s,'addPc',{paymentMethod:'cash',shiftId,price}));
  assert.equal(s.shifts[0].items.length,0);
  s = change(s,'addPc',{paymentMethod:'cash',shiftId,price:100});
  for (const patch of [{quantity:2},{name:'PS'},{discountPercent:10,unitPrice:90}]) {
    const modified = structuredClone(s); Object.assign(modified.shifts[0].items[0],patch);
    assert.throws(() => validateState(modified));
  }
});
