const ExcelJS = require('exceljs');
const { total, paymentTotal } = require('./domain.cjs');
function workbookFor(shift) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Dlya Adminov';
  const sheet = book.addWorksheet('Отчёт', { views: [{ state: 'frozen', ySplit: 5 }] });
  sheet.columns = [{ width: 7 }, { width: 14 }, { width: 45 }, { width: 14 }, { width: 19 }, { width: 21 }, { width: 19 }];
  sheet.mergeCells('A1:G1'); sheet.getCell('A1').value = 'Dlya Adminov · Отчёт';
  sheet.getCell('A1').font = { size: 19, bold: true, color: { argb: 'FF225549' } };
  sheet.getRow(1).height = 36;
  const formatted = shift.date.split('-').reverse().join('.');
  sheet.mergeCells('A2:G2'); sheet.getCell('A2').value = `${formatted} — ${shift.period === 'day' ? 'день' : 'ночь'}`;
  sheet.mergeCells('A3:G3'); sheet.getCell('A3').value = shift.status === 'active' ? 'Промежуточный отчёт · учёт продолжается' : 'Завершённый учёт';
  sheet.getRow(5).values = ['№', 'Группа', 'Название', 'Количество', 'Цена за ед., ₽', 'Сумма, ₽', 'Оплата'];
  sheet.getRow(5).height = 28;
  sheet.getRow(5).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF225549' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
  shift.items.forEach((item, index) => {
    const row = sheet.addRow([index + 1, { product: 'Товар', service: 'PS', pc: 'ПК' }[item.kind], item.name, item.quantity, item.unitPrice, item.unitPrice * item.quantity, { cash: 'Наличка', transfer: 'Перевод' }[item.paymentMethod] || 'Не указано']);
    row.height = 25;
    row.getCell(3).alignment = { wrapText: true, vertical: 'middle' };
    row.getCell(5).numFmt = '#,##0'; row.getCell(6).numFmt = '#,##0';
  });
  if (shift.items.length) sheet.autoFilter = { from: 'A5', to: `G${5 + shift.items.length}` };
  sheet.addRow([]);
  const subtotals = [['Товары', total(shift, 'product')], ['PS', total(shift, 'service')], ['ПК', total(shift, 'pc')], ['Наличка', paymentTotal(shift, 'cash')], ['Перевод', paymentTotal(shift, 'transfer')]];
  if (shift.items.some(i => !i.paymentMethod)) subtotals.push(['Не указано', paymentTotal(shift, null)]);
  subtotals.push(['ИТОГО', total(shift)]);
  for (const [label, sum] of subtotals) {
    const row = sheet.addRow(['', '', label, '', '', sum]);
    row.font = { bold: true }; row.getCell(6).numFmt = '#,##0" ₽"'; row.height = 26;
  }
  sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return book;
}
module.exports = { workbookFor };
