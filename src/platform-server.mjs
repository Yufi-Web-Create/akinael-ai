import { createApp as createLegacyApp } from './server.mjs';
import { createPlatformApi } from './platform-api.mjs';

const PORT = Number(process.env.PORT || 3000);
const isBlockedLegacyPersonalDataRoute = (request, pathname) => request.method === 'POST' && (
  pathname === '/api/auth/register' ||
  pathname === '/api/public/chat' ||
  pathname === '/api/projects' ||
  pathname.startsWith('/api/projects/')
);
const PERSONAL_DATA_COLLECTION_MESSAGE = 'new registration and consultation intake are unavailable until the terms and privacy policy are published';

export const createApp = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const server = createLegacyApp();
  const legacyHandler = server.listeners('request')[0];
  server.removeAllListeners('request');
  const platformApi = createPlatformApi({ env, fetchImpl });

  server.on('request', async (request, response) => {
    try {
      const handled = await platformApi.handle(request, response);
      if (handled) return;
      if (isBlockedLegacyPersonalDataRoute(request, new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname)) {
        response.writeHead(503, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff'
        });
        return response.end(JSON.stringify({ error: { code: 'consultation_intake_closed', message: PERSONAL_DATA_COLLECTION_MESSAGE } }));
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
