// Dark-mode toggle for the docs site. Flips data-mode="dark" on <html>,
// persisted in localStorage; vanilla-breeze styles [data-theme~=classic][data-mode=dark].
(() => {
  const root = document.documentElement;
  if (localStorage.getItem('mode') === 'dark') root.dataset.mode = 'dark';
  const btn = document.getElementById('mode-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (root.dataset.mode === 'dark') {
      delete root.dataset.mode;
      localStorage.removeItem('mode');
    } else {
      root.dataset.mode = 'dark';
      localStorage.setItem('mode', 'dark');
    }
  });
})();
