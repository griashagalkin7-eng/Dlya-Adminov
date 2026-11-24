const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initialState, applyCommand, validateState } = require('../electron/domain.cjs');
const { Store } = require('../electron/store.cjs');
const { adminDay, adminDays, operationalDate } = require('../src/admin-stats.mjs');
const change = (s,type,payload) => applyCommand(s,{type,payload});
function start(s,date,period,amount) {
  s=change(s,'start',{date,period});
  return change(s,'addPc',{shiftId:s.shifts.at(-1).id,price:amount,paymentMethod:'cash'});
}
const finish = s => change(s,'finish',{shiftId:s.shifts.at(-1).id});
test('10% uses the entire dated day and night, including the active shift and all categories', () => {
  let s=change(initialState(),'catalogSave',{catalog:'products',name:'Товар',price:1000});
  s=start(s,'2026-11-24','day',11000);
  s=change(s,'addProduct',{shiftId:s.shifts.at(-1).id,productId:s.products[0].id,quantity:1,paymentMethod:'cash'});
  s=finish(s);
  s=start(s,'2026-11-24','night',7000);
  const shiftId=s.shifts.at(-1).id;
  s=change(s,'addService',{shiftId,name:'PS',price:1000,discount:false,paymentMethod:'transfer'});
  let day=adminDay(s,'2026-11-24');
  assert.equal(day.revenue,20000); assert.equal(day.percent,10); assert.equal(day.amount,2000);
  assert.equal(day.live,true); assert.equal(day.hasDay,true); assert.equal(day.hasNight,true);
  s=finish(s); s=start(s,'2026-11-25','day',5000);
  assert.equal(adminDay(s,'2026-11-24').amount,2000);
  assert.equal(adminDay(s,'2026-11-24').live,false);
  assert.equal(adminDay(s,'2026-11-25').amount,500);
});
test('operational date switches at 08:00, not midnight, including month and year boundaries', () => {
  assert.equal(operationalDate(new Date(2026,10,25,0,1)),'2026-11-24');
  assert.equal(operationalDate(new Date(2026,10,25,7,59)),'2026-11-24');
  assert.equal(operationalDate(new Date(2026,10,25,8,0)),'2026-11-25');
  assert.equal(operationalDate(new Date(2026,11,1,7,59)),'2026-11-30');
  assert.equal(operationalDate(new Date(2027,0,1,7,59)),'2026-12-31');
});
test('daily amount is rounded once after combining repeated day/night shifts', () => {
  let s=finish(start(initialState(),'2026-11-24','day',2));
  s=finish(start(s,'2026-11-24','day',1));
  s=finish(start(s,'2026-11-24','night',2));
  assert.equal(adminDay(s,'2026-11-24').amount,1);
  s=finish(start(s,'2026-11-25','day',5));
  s=finish(start(s,'2026-12-01','day',100));
  const days=adminDays(s,'2026-11');
  assert.equal(days.length,2);
  assert.equal(days.reduce((sum,d) => sum+d.amount,0),2);
});
test('new default freezes past dates, the night keeps its day rate, explicit corrections recalculate', () => {
  let s=finish(start(initialState(),'2026-11-24','day',1000));
  s=change(s,'adminPercent',{percent:15});
  s=finish(start(s,'2026-11-24','night',1000));
  assert.equal(adminDay(s,'2026-11-24').percent,10);
  assert.equal(adminDay(s,'2026-11-24').amount,200);
  s=finish(start(s,'2026-11-25','day',1000));
  assert.equal(adminDay(s,'2026-11-25').amount,150);
  s=change(s,'adminRate',{date:'2026-11-24',percent:20});
  assert.equal(adminDay(s,'2026-11-24').amount,400);
  const first=s.shifts[0];
  s=change(s,'editItem',{shiftId:first.id,itemId:first.items[0].id,price:1500});
  assert.equal(adminDay(s,'2026-11-24').amount,500);
  s=change(s,'deleteShift',{shiftId:first.id});
  assert.equal(adminDay(s,'2026-11-24').amount,200);
  s=change(s,'shiftMeta',{shiftId:s.shifts[0].id,date:'2026-11-25',period:'night'});
  assert.equal(adminDay(s,'2026-11-24').revenue,0);
  assert.equal(adminDay(s,'2026-11-25').amount,300);
});
test('legacy ledgers stay unchanged on read, default to 10%, and preserve rates across restart', t => {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dlya-admin-percent-'));
  t.after(() => fs.rmSync(folder,{recursive:true,force:true}));
  const fixture=fs.readFileSync(path.join(__dirname,'fixtures/ledger-v1.json'),'utf8');
  fs.writeFileSync(path.join(folder,'ledger.json'),fixture);
  const store=new Store(folder);
  assert.deepEqual(store.read(),JSON.parse(fixture));
  assert.equal(adminDay(store.read(),'2026-11-19').amount,69);
  store.execute({type:'adminPercent',payload:{percent:12.5}});
  const state=new Store(folder).read();
  assert.equal(adminDay(state,'2026-11-19').percent,10);
  assert.equal(adminDay(state,'2026-11-19').amount,69);
  assert.equal(state.settings.adminPercent,12.5);
});
test('zero rate is valid; invalid percentages and dates are rejected', () => {
  const s=initialState();
  for (const percent of [-1,101,NaN,Infinity,'10',0.001]) {
    assert.throws(() => change(s,'adminPercent',{percent}));
    assert.throws(() => change(s,'adminRate',{date:'2026-11-24',percent}));
  }
  assert.throws(() => change(s,'adminRate',{date:'2026-02-30',percent:10}));
  const zero=change(s,'adminRate',{date:'2026-11-24',percent:0});
  assert.equal(adminDay(zero,'2026-11-24').percent,0);
  const invalid=structuredClone(s); invalid.adminRates={'bad-date':10};
  assert.throws(() => validateState(invalid));
});
