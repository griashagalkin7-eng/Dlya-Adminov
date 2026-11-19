const { spawn } = require('node:child_process');
const path = require('node:path');
const vite = spawn(process.execPath, [path.join(__dirname, '../node_modules/vite/bin/vite.js')], { stdio: 'inherit' });
let electron;
const stop = () => { electron?.kill(); vite.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
(async () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch('http://127.0.0.1:5173'); if (response.ok) break; } catch {}
    if (attempt === 99) { stop(); process.exit(1); }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  electron = spawn(require('electron'), ['.'], { stdio: 'inherit', env: { ...process.env, DLYA_DEV_URL: 'http://127.0.0.1:5173' } });
  electron.on('exit', () => { vite.kill(); });
})();
