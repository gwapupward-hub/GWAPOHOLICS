/**
 * Keep regular pages below Telegram's floating controls in fullscreen Mini Apps.
 * Telegram safeAreaInset and contentSafeAreaInset are separate values.
 * Do not use hardcoded device-specific notch dimensions when both are provided.
 */
const finiteInset = (value) => {
  const n=Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(500,n) : 0;
};
export function readTelegramFrame(tg) {
  const safe=tg?.safeAreaInset||{};
  const content=tg?.contentSafeAreaInset||{};
  const safeTop=finiteInset(safe.top);
  const contentTop=finiteInset(content.top);
  const isFullscreen=tg?.isFullscreen===true || (tg?.isExpanded===true && contentTop>=75);
  return {
    isFullscreen,
    // The fallback covers Telegram overlays on SDK versions that report zero.
    top: isFullscreen ? Math.max(116, safeTop+contentTop+10) : 0,
    bottom: isFullscreen ? Math.max(finiteInset(safe.bottom),finiteInset(content.bottom)) : 0
  };
}
export function syncTelegramFrame(tg, doc) {
  const frame=readTelegramFrame(tg);
  const html=doc?.documentElement;
  if(!html) return frame;
  html.classList.toggle('telegram-fullscreen',frame.isFullscreen);
  html.style.setProperty('--gwap-telegram-top',frame.top+'px');
  html.style.setProperty('--gwap-telegram-bottom',frame.bottom+'px');
  return frame;
}
