// Chromium writes page console errors to stderr in more than one format.
// In particular, resource failures use `ERROR:CONSOLE(...)`, while some
// launchers produce `CONSOLE ERROR`. Treat either form as a release failure.
export const hasBrowserConsoleError = (output) => /\b(?:ERROR|SEVERE)\s*:?\s*CONSOLE\b|\bCONSOLE\b.*\b(?:ERROR|SEVERE)\b/i.test(output);
