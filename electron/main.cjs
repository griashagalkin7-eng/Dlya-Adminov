const { app, BrowserWindow, ipcMain, dialog, Menu, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Store } = require('./store.cjs');
const { getShift } = require('./domain.cjs');
const { workbookFor } = require('./export.cjs');
const devUrl = !app.isPackaged && process.env.DLYA_DEV_URL === 'http://127.0.0.1:5173' ? process.env.DLYA_DEV_URL : null;
const entry = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
app.setName('Dlya Adminov');
let window, store;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    const dataFolder = !app.isPackaged && process.env.DLYA_DEV_DATA_DIR ? process.env.DLYA_DEV_DATA_DIR : path.join(app.getPath('appData'), 'Dlya Adminov');
    try { store = new Store(dataFolder); }
    catch (error) { dialog.showErrorBox('Не удалось открыть учёт', `Данные не перезаписаны.\n${error.message}\n\nПапка: ${dataFolder}`); app.quit(); return; }
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    const assertSender = (event) => {
      const url = event.senderFrame?.url;
      if (event.sender !== window?.webContents || !url || (devUrl ? new URL(url).origin !== devUrl : url !== entry)) throw new Error('Недопустимый источник запроса.');
    };
    ipcMain.handle('ledger:read', event => { assertSender(event); return store.read(); });
    ipcMain.handle('ledger:command', (event, command) => {
      assertSender(event);
      try { return { ok: true, state: store.execute(command) }; }
      catch (error) { return { ok: false, error: error.message }; }
    });
    ipcMain.handle('ledger:export', async (event, shiftId) => {
      assertSender(event);
      try {
        const shift = getShift(store.read(), shiftId);
        const result = await dialog.showSaveDialog(window, {
          title: 'Сохранить отчёт Excel',
          defaultPath: path.join(app.getPath('documents'), `${shift.date}_${shift.period === 'day' ? 'день' : 'ночь'}_${shift.id.slice(0, 8)}.xlsx`),
          filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        });
        if (result.canceled || !result.filePath) return { ok: true, canceled: true };
        const filename = result.filePath.toLowerCase().endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
        await workbookFor(shift).xlsx.writeFile(filename);
        return { ok: true };
      } catch (error) { return { ok: false, error: `Не удалось сохранить отчёт. ${error.message}` }; }
    });
    window = new BrowserWindow({ width: 1280, height: 850, minWidth: 1000, minHeight: 700, title: 'Dlya Adminov', backgroundColor: '#f5f6f8', show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.once('ready-to-show', () => window.show());
    if (devUrl) window.loadURL(devUrl); else window.loadFile(path.join(__dirname, '../dist/index.html'));
  });
  app.on('window-all-closed', () => app.quit());
}
