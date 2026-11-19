const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { Store } = require('../electron/store.cjs');
const { workbookFor } = require('../electron/export.cjs');
const temporary = t => { const folder = fs.mkdtempSync(path.join(os.tmpdir(),'dlya-adminov-test-')); t.after(() => fs.rmSync(folder,{recursive:true,force:true})); return folder; };
test('active shift survives restart; storage errors leave last committed state intact', t => {
  const folder = temporary(t);
  const store = new Store(folder);
  store.execute({type:'start',payload:{date:'2026-11-19',period:'day'}});
  const shiftId = store.read().shifts[0].id;
  store.execute({type:'addService',payload:{shiftId,name:'ТВ2 2 часа',price:600,discount:false}});
  const expected = store.read();
  assert.deepEqual(new Store(folder).read(),expected);
  store.file = folder; // Rename onto a directory must fail, even under elevated permissions.
  assert.throws(() => store.execute({type:'discount',payload:{discount:15}}),/Не удалось сохранить/);
  assert.deepEqual(store.read(),expected);
  assert.deepEqual(new Store(folder).read(),expected);
});
test('corrupt data is preserved and reported instead of silently starting empty', t => {
  const folder = temporary(t);
  const filename = path.join(folder,'ledger.json');
  fs.writeFileSync(filename,'{"broken":true}');
  assert.throws(() => new Store(folder),/формат данных/);
  assert.equal(fs.readFileSync(filename,'utf8'),'{"broken":true}');
});
test('XLSX round trip preserves Russian names, final prices, totals and literal text', async t => {
  const folder = temporary(t);
  const store = new Store(folder);
  let state = store.execute({type:'start',payload:{date:'2026-11-19',period:'night'}});
  const shiftId = state.shifts[0].id;
  store.execute({type:'discount',payload:{discount:10}});
  state = store.execute({type:'addService',payload:{shiftId,name:'=ТВ3 — 1,5 часа',price:550,discount:true}});
  const filename = path.join(folder,'отчёт.xlsx');
  await workbookFor(state.shifts[0]).xlsx.writeFile(filename);
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile(filename);
  const sheet = book.worksheets[0];
  assert.equal(sheet.getCell('A2').value,'19.11.2026 — ночь');
  assert.equal(sheet.getCell('C6').value,'=ТВ3 — 1,5 часа');
  assert.equal(sheet.getCell('C6').type,ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('E6').value,495);
  assert.equal(sheet.getCell('F6').value,495);
  assert.equal(sheet.getCell(`F${sheet.rowCount}`).value,495);
});
