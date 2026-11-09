/*
 * Pre-paint theme bootstrap.
 *
 * `applyAppTheme` mirrors the last applied theme selection into localStorage so
 * the first paint can already use it instead of flashing the default dark theme
 * while the application profile settings load asynchronously.
 *
 * The `known` list must stay in sync with APP_THEME_IDS in
 * src/features/app/themeService.ts (guarded by themeSystemAudit.test.ts). A
 * `system` selection is resolved here with the same map as themePalettes.json.
 *
 * It is a classic script (not a module) so it runs before the renderer bundle and
 * does not require an inline-script CSP allowance.
 */
(function () {
  try {
    var stored = window.localStorage.getItem('eod.appTheme');
    var known = [
      'midnight-slate-pro',
      'amoled-black',
      'classic-light',
      'classic-light-refined',
      'deep-light',
      'refinitiv-dark',
      'tos-charcoal'
    ];
    if (stored === 'system') {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute(
        'data-theme',
        prefersDark ? 'midnight-slate-pro' : 'classic-light'
      );
      return;
    }
    if (stored && known.indexOf(stored) !== -1) {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (error) {
    // Storage can be unavailable; the renderer still applies the stored profile theme.
  }
})();
