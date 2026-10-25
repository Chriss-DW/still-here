/* Portada: entrada breve, encuadre del grabado y desplazamiento discreto. */
(() => {
  'use strict';
  const hero = document.querySelector('.hero-editorial');
  if (!hero) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const loader = document.getElementById('loader');
  const number = document.getElementById('loaderNum');

  if (loader && number && !reducedMotion.matches) {
    loader.hidden = false;
    const start = performance.now();
    const updateLoader = now => {
      const amount = Math.min(1, (now - start) / 450);
      number.textContent = String(Math.round(amount * 100)).padStart(2, '0');
      if (amount < 1) {
        requestAnimationFrame(updateLoader);
      } else {
        loader.classList.add('hidden');
        setTimeout(() => { loader.hidden = true; }, 800);
      }
    };
    requestAnimationFrame(updateLoader);
  }

  const title = hero.querySelector('h1 > .line:first-child > span');
  let artworkFrame = 0;
  const alignArtwork = () => {
    cancelAnimationFrame(artworkFrame);
    artworkFrame = requestAnimationFrame(() => {
      if (!title) return;
      const gap = Math.min(40, Math.max(16, innerWidth * .02));
      const left = title.getBoundingClientRect().right - hero.getBoundingClientRect().left + gap;
      hero.style.setProperty('--hero-art-left', `${left}px`);
    });
  };
  if (title) new ResizeObserver(alignArtwork).observe(title);
  addEventListener('resize', alignArtwork, { passive: true });
  document.fonts.ready.then(alignArtwork);
  alignArtwork();

  let scrollFrame = 0;
  const updateParallax = () => {
    scrollFrame = 0;
    const progress = Math.max(0, Math.min(scrollY / innerHeight, 1));
    hero.style.setProperty('--hero-scroll', reducedMotion.matches ? '0' : progress.toFixed(3));
  };
  addEventListener('scroll', () => {
    if (!scrollFrame && !reducedMotion.matches) scrollFrame = requestAnimationFrame(updateParallax);
  }, { passive: true });
  reducedMotion.addEventListener('change', updateParallax);
})();
