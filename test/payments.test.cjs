const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { initialState, applyCommand, total, paymentTotal, validateState } = require('../electron/domain.cjs');
const { Store } = require('../electron/store.cjs');
const { workbookFor } = require('../electron/export.cjs');
const change = (s,type,payload) => applyCommand(s,{type,payload});
test('same product merges only within its payment method', () => {
  let s=change(initialState(),'catalogSave',{catalog:'products',name:'Вода',price:100});
  s=change(s,'start',{date:'2026-11-24',period:'day'});
  const shiftId=s.shifts[0].id,productId=s.products[0].id;
  for (const paymentMethod of ['cash','transfer','cash']) s=change(s,'addProduct',{shiftId,productId,quantity:1,paymentMethod});
  const shift=s.shifts[0];
  assert.equal(shift.items.length,2);
  assert.equal(paymentTotal(shift,'cash'),200);
  assert.equal(paymentTotal(shift,'transfer'),100);
  assert.equal(total(shift),300);
  s=change(s,'editItem',{shiftId,itemId:shift.items[0].id,quantity:2,paymentMethod:'transfer'});
  assert.equal(paymentTotal(s.shifts[0],'cash'),0);
  assert.equal(paymentTotal(s.shifts[0],'transfer'),300);
});
test('all new payment entries require a valid method; malformed saved methods are rejected', () => {
  let s=change(initialState(),'catalogSave',{catalog:'products',name:'Вода',price:100});
  s=change(s,'start',{date:'2026-11-24',period:'day'});
  const shiftId=s.shifts[0].id,productId=s.products[0].id;
  for (const type of ['addProduct','addService','addPc']) {
    for (const paymentMethod of [undefined,null,'card','',0]) {
      assert.throws(() => change(s,type,{shiftId,productId,quantity:1,name:'ТВ',price:100,paymentMethod}),/оплату/);
    }
  }
  s=change(s,'addPc',{shiftId,price:500,paymentMethod:'transfer'});
  assert.equal(s.shifts[0].items[0].unitPrice,500);
  const invalid=structuredClone(s); invalid.shifts[0].items[0].paymentMethod='card';
  assert.throws(() => validateState(invalid),/оплату/);
});
test('legacy entries remain unclassified until explicitly edited, across restart and XLSX', async t => {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dlya-payment-'));
  t.after(() => fs.rmSync(folder,{recursive:true,force:true}));
  const fixture=fs.readFileSync(path.join(__dirname,'fixtures/ledger-v1.json'),'utf8');
  fs.writeFileSync(path.join(folder,'ledger.json'),fixture);
  const store=new Store(folder);
  assert.deepEqual(store.read(),JSON.parse(fixture));
  store.execute({type:'addPc',payload:{shiftId:'active-v1',price:700,paymentMethod:'cash'}});
  let s=store.execute({type:'addService',payload:{shiftId:'active-v1',name:'ТВ3',price:400,discount:false,paymentMethod:'transfer'}});
  let shift=s.shifts[1];
  assert.equal(paymentTotal(shift,null),500);
  assert.equal(paymentTotal(shift,'cash'),700);
  assert.equal(paymentTotal(shift,'transfer'),400);
  assert.equal(total(shift),1600);
  const book=new ExcelJS.Workbook(); await book.xlsx.load(await workbookFor(shift).xlsx.writeBuffer());
  const sheet=book.worksheets[0];
  assert.equal(sheet.getCell('G6').value,'Не указано');
  assert.equal(sheet.getCell('G7').value,'Наличка');
  assert.equal(sheet.getCell('G8').value,'Перевод');
  const subtotals=new Map(); sheet.eachRow(row => { if(row.number>8)subtotals.set(row.getCell(3).value,row.getCell(6).value); });
  assert.equal(subtotals.get('Наличка'),700);
  assert.equal(subtotals.get('Перевод'),400);
  assert.equal(subtotals.get('Не указано'),500);
  assert.equal(subtotals.get('ИТОГО'),1600);
  assert.deepEqual(new Store(folder).read(),s);
  s=store.execute({type:'editItem',payload:{shiftId:'active-v1',itemId:'old-service-entry',name:'ТВ2 2 часа',price:500,discount:false,paymentMethod:'transfer'}});
  shift=s.shifts[1];
  assert.equal(paymentTotal(shift,null),0);
  assert.equal(paymentTotal(shift,'transfer'),900);
  store.execute({type:'deleteItem',payload:{shiftId:'active-v1',itemId:shift.items[1].id}});
  assert.equal(paymentTotal(new Store(folder).read().shifts[1],'cash'),0);
});
