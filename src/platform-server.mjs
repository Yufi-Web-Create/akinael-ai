import { createApp as createLegacyApp } from './server.mjs';
import { createPlatformApi } from './platform-api.mjs';

const PORT = Number(process.env.PORT || 3000);
const isRetiredPublicIntakeRoute = (request, pathname) => request.method === 'POST' && (
  pathname === '/api/auth/register' ||
  pathname === '/api/public/chat'
);

export const createApp = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const server = createLegacyApp();
  const legacyHandler = server.listeners('request')[0];
  server.removeAllListeners('request');
  const platformApi = createPlatformApi({ env, fetchImpl });

  server.on('request', async (request, response) => {
    try {
      const handled = await platformApi.handle(request, response);
      if (handled) return;
      // Retire only the unauthenticated legacy intake routes that can bypass the
      // v2 consent record. Authenticated legacy administration remains available
      // until its UI and API are migrated together.
      const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
      if (isRetiredPublicIntakeRoute(request, pathname)) {
        response.writeHead(410, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff'
        });
        return response.end(JSON.stringify({ error: { code: 'legacy_intake_retired', message: 'use the consent-protected customer portal' } }));
      }
      return await legacyHandler(request, response);
    } catch {
      if (response.headersSent) return response.end();
      response.writeHead(500, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      });
      response.end(JSON.stringify({ error: { code: 'internal_error', message: 'internal server error' } }));
    }
  });

  return server;
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  createApp().listen(PORT, () => console.log(`akinael core listening on http://localhost:${PORT}`));
}
