const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ledger', {
  read: () => ipcRenderer.invoke('ledger:read'),
  command: (command) => ipcRenderer.invoke('ledger:command', command),
  exportXlsx: (shiftId) => ipcRenderer.invoke('ledger:export', shiftId)
});
