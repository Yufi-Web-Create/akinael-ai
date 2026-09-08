(async () => {
  // Capture the hash once, synchronously, before the first await. app.js
  // (loaded with `defer` on this same page) also inspects location.hash and
  // will strip it via history.replaceState once the document finishes
  // parsing -- which reliably happens before this script's own network
  // round-trip resolves. Using a captured copy here means the eventual
  // redirect is correct even if something else mutates location.hash first.
  const capturedHash = location.hash;
  if (!(capturedHash.includes('type=recovery') && capturedHash.includes('access_token='))) return;
  const params = new URLSearchParams(capturedHash.slice(1));
  const accessToken = params.get('access_token');
  let destination = '/portal/';
  try {
    const response = await fetch('/api/v2/auth/me', { headers: { authorization: `Bearer ${accessToken}` } });
    if (response.ok) {
      const body = await response.json();
      if (body?.profile?.role === 'admin') destination = '/admin/';
    }
  } catch {
    /* fall back to the customer destination if the role lookup fails */
  }
  location.replace(`${destination}?mode=recovery${capturedHash}`);
})();
