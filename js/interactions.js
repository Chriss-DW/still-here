/* Progreso discreto; el relato funciona también sin JavaScript. */
(() => {
  'use strict';
  const progress = document.querySelector('.reading-progress');
  let pending = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const amount = max > 0 ? Math.max(0, Math.min(1, scrollY / max)) : 0;
    if (progress) {
      progress.style.transform = `scaleX(${amount})`;
      progress.setAttribute('aria-valuenow', Math.round(amount * 100));
    }
    pending = false;
  };
  addEventListener('scroll', () => {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', update);
  update();
})();
