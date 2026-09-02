import { createApp as createLegacyApp } from './server.mjs';
import { createPlatformApi } from './platform-api.mjs';

const PORT = Number(process.env.PORT || 3000);
const isRetiredLegacyApiRoute = (pathname) => pathname.startsWith('/api/') && !pathname.startsWith('/api/v2/');

export const createApp = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const server = createLegacyApp();
  const legacyHandler = server.listeners('request')[0];
  server.removeAllListeners('request');
  const platformApi = createPlatformApi({ env, fetchImpl });

  server.on('request', async (request, response) => {
    try {
      const handled = await platformApi.handle(request, response);
      if (handled) return;
      // The legacy server has its own authentication, persistence, and LLM
      // dispatch path. It must never be reachable from the production network:
      // doing so would let customer data bypass v2's Supabase identity, confirmed
      // email, and legal-consent checks. Administrative migration work belongs on
      // an explicitly protected internal interface, not this public entrypoint.
      const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
      if (isRetiredLegacyApiRoute(pathname)) {
        response.writeHead(410, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff'
        });
        return response.end(JSON.stringify({ error: { code: 'legacy_api_retired', message: 'use the v2 API' } }));
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
