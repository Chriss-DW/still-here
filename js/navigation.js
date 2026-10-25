/* El mismo índice nativo en la HOME y los cuatro actos. */
(() => {
  'use strict';
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('pointermove', event => {
      if (!finePointer.matches) return;
      const bounds = link.getBoundingClientRect();
      link.style.setProperty('--act-pointer-x', `${event.clientX - bounds.left}px`);
      link.style.setProperty('--act-pointer-y', `${event.clientY - bounds.top}px`);
    });
    link.addEventListener('pointerleave', () => {
      link.style.removeProperty('--act-pointer-x');
      link.style.removeProperty('--act-pointer-y');
    });
  });
  const dialog = document.getElementById('editorialIndex');
  const toggle = document.getElementById('indexToggle');
  const close = document.getElementById('indexClose');
  let savedOverflow = '';
  let returnFocus = true;
  if (dialog && toggle && close) {
    toggle.addEventListener('click', () => {
      if (dialog.open) return;
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      returnFocus = true;
      dialog.showModal();
      toggle.setAttribute('aria-expanded', 'true');
      dialog.scrollTop = 0;
      close.focus({ preventScroll: true });
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('a[href],button:not([disabled])')]
        .filter(item => item.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
    dialog.addEventListener('close', () => {
      document.body.style.overflow = savedOverflow;
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus({ preventScroll: true });
    });
    dialog.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      returnFocus = false;
      dialog.close();
    }));
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' });
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
      target.focus({ preventScroll: true });
      history.replaceState(null, '', link.hash);
    });
  });
})();
