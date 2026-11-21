import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { Store } = require('../electron/store.cjs');
const { getShift } = require('../electron/domain.cjs');
const { workbookFor } = require('../electron/export.cjs');

export function previewPlugin() {
  return {
    name: 'local-ledger-preview',
    apply: 'serve',
    transformIndexHtml(html) {
      // React's development preamble is inline. Production CSP stays restrictive.
      return html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
        .replace('ws://127.0.0.1:5173;', 'ws://127.0.0.1:5173 ws://localhost:5173;');
    },
    configureServer(server) {
      const directory = path.resolve(import.meta.dirname, '../../preview-data');
      const fresh = !existsSync(path.join(directory, 'ledger.json'));
      const store = new Store(directory);
      if (fresh) {
        for (const [name, price] of [['Вода 0,5 л',100],['Кола 0,5 л',150],['Чипсы',200]])
          store.execute({ type:'catalogSave',payload:{catalog:'products',name,price} });
        for (const name of ['ТВ1 — 1 час','ТВ2 — 2 часа','ТВ3 — 1,5 часа'])
          store.execute({ type:'catalogSave',payload:{catalog:'services',name} });
      }
      server.middlewares.use(async (req,res,next) => {
        if (!req.url?.startsWith('/__preview/')) return next();
        res.setHeader('Cache-Control','no-store');
        res.setHeader('X-Content-Type-Options','nosniff');
        const json = (status,value) => { res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
        const host = req.headers.host;
        if (!['localhost:5173','127.0.0.1:5173'].includes(host) || (req.headers.origin && req.headers.origin !== `http://${host}`)) return json(403,{ok:false,error:'Недопустимый источник запроса.'});
        try {
          if (req.method === 'GET' && req.url === '/__preview/state') return json(200,store.read());
          if (req.method === 'POST' && req.url === '/__preview/command') {
            if (!req.headers['content-type']?.startsWith('application/json')) return json(415,{ok:false,error:'Ожидается JSON.'});
            let body = '';
            for await (const part of req) {
              body += part.toString('utf8');
              if (Buffer.byteLength(body) > 65536) return json(413,{ok:false,error:'Слишком большой запрос.'});
            }
            return json(200,{ok:true,state:store.execute(JSON.parse(body))});
          }
          if (req.method === 'GET' && req.url.startsWith('/__preview/export/')) {
            const shift = getShift(store.read(),decodeURIComponent(req.url.slice('/__preview/export/'.length)));
            const buffer = await workbookFor(shift).xlsx.writeBuffer();
            res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition',`attachment; filename="${shift.date}_${shift.period}_${shift.id.slice(0,8)}.xlsx"`);
            return res.end(buffer);
          }
          return json(404,{ok:false,error:'Адрес не найден.'});
        } catch (error) { return json(400,{ok:false,error:error.message}); }
      });
    }
  };
}
