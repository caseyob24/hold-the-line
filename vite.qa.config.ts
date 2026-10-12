import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// QA harness: swaps the Supabase client for an in-memory fake and stubs /api/* functions.
const fake = fileURLToPath(new URL('./qa/supabase.fake.ts', import.meta.url));

const apiStub: Plugin = {
  name: 'qa-api-stub',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      const path = req.url.slice(5).split('?')[0];
      const body = (o: unknown, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      const today = new Date();
      const iso = (h: number) => { const d = new Date(today); d.setHours(h, 0, 0, 0); return d.toISOString(); };
      if (path === 'scores') return body({ updated: today.toISOString(), games: [
        { league: 'nfl', id: '1', state: 'in', detail: 'Q3 8:12', start: iso(13), home: { name: 'Las Vegas Raiders', abbr: 'LV', score: '17', rank: null }, away: { name: 'Kansas City Chiefs', abbr: 'KC', score: '21', rank: null }, networks: ['CBS'], tv: { label: 'CBS (KLAS)', channel: '8', streaming: false } },
        { league: 'ncaaf', id: '2', state: 'pre', detail: '7:30 PM', start: iso(19), home: { name: 'UNLV Rebels', abbr: 'UNLV', score: null, rank: 22 }, away: { name: 'Boise State', abbr: 'BSU', score: null, rank: null }, networks: ['FS1'], tv: { label: 'FS1', channel: '219', streaming: false } },
        { league: 'nhl', id: '3', state: 'post', detail: 'Final', start: iso(10), home: { name: 'Vegas Golden Knights', abbr: 'VGK', score: '4', rank: null }, away: { name: 'Colorado Avalanche', abbr: 'COL', score: '2', rank: null }, networks: ['ESPN+'], tv: { label: 'ESPN+', channel: null, streaming: true } },
      ] });
      if (path === 'email-login') return body({ token_hash: 'qa', created: false });
      if (path === 'push-flush') return body({ sent: 1 });
      if (path === 'delete-account') return body({ deleted: true });
      if (path === 'notify-message') return body({ ok: true });
      if (path === 'ms-auth-start') return body({ error: 'Outlook is not connected in QA.' }, 500);
      if (path === 'calendar') return body({ error: 'Connect Outlook first.' }, 401);
      return body({ error: `no stub for ${path}` }, 404);
    });
  },
};

export default defineConfig({
  plugins: [react(), apiStub],
  resolve: { alias: [{ find: /^(\.\.\/lib|\.\/lib|\.)\/supabase$/, replacement: fake }] },
  server: { port: 5190, strictPort: true },
  define: { 'import.meta.env.VITE_VAPID_PUBLIC_KEY': '"qa"' },
});
