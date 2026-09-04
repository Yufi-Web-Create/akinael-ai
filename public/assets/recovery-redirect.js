if (location.hash.includes('type=recovery') && location.hash.includes('access_token=')) {
  location.replace(`/admin/?mode=recovery${location.hash}`);
}
