(async () => {
  if (!(location.hash.includes('type=recovery') && location.hash.includes('access_token='))) return;
  const params = new URLSearchParams(location.hash.slice(1));
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
  location.replace(`${destination}?mode=recovery${location.hash}`);
})();
