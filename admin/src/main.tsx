import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Admin from "./Admin";
// Self-hosted (not Google Fonts CDN) so the existing strict font-src 'self' CSP
// (see src/server.mjs serveStatic) does not need to be weakened for this redesign.
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Admin />
  </StrictMode>
);
