import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted (not Google Fonts CDN) so the existing strict `font-src 'self'` CSP
// (see src/server.mjs serveStatic) does not need to be weakened for this redesign.
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/noto-serif-jp/400.css";
import "@fontsource/noto-serif-jp/600.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
