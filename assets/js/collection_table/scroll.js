(() => {
  const CollectionTable = window.CollectionTable || (window.CollectionTable = {});
  CollectionTable._modules = CollectionTable._modules || {};
  if (CollectionTable._modules.scroll) return;
  CollectionTable._modules.scroll = true;

  const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, label, summary, details, [role="button"]';
  let hoveredWrap = null;

  function isInteractiveTarget(target) {
    return !!(target && target.closest && target.closest(INTERACTIVE_SELECTOR));
  }

  function isEditableElement(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    const role = (el.getAttribute && el.getAttribute('role')) || '';
    if (role === 'textbox') return true;
    return false;
  }

  function setKeyboardNavMode(on) {
    const root = document.documentElement;
    if (on) root.classList.add('kbd-nav');
    else root.classList.remove('kbd-nav');
  }

  function initInputModalityTracker() {
    if (document.documentElement.dataset.kbdNavInit === '1') return;
    document.documentElement.dataset.kbdNavInit = '1';

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') setKeyboardNavMode(true);
    }, true);

    window.addEventListener('pointerdown', () => {
      setKeyboardNavMode(false);
    }, true);
  }

  function canScrollX(wrap) {
    return wrap.scrollWidth > wrap.clientWidth + 1;
  }

  function canScrollY(wrap) {
    return wrap.scrollHeight > wrap.clientHeight + 1;
  }

  function handleScrollKeys(wrap, e, allowVertical) {
    const hasX = canScrollX(wrap);
    const hasY = canScrollY(wrap);
    if (!hasX && !hasY) return false;

    const line = 40;
    const pageX = Math.max(120, Math.floor(wrap.clientWidth * 0.9));
    const pageY = Math.max(120, Math.floor(wrap.clientHeight * 0.9));

    switch (e.key) {
      case 'ArrowLeft':
        if (!hasX) return false;
        e.preventDefault();
        wrap.scrollLeft -= line;
        return true;
      case 'ArrowRight':
        if (!hasX) return false;
        e.preventDefault();
        wrap.scrollLeft += line;
        return true;
      case 'Home':
        if (!hasX) return false;
        e.preventDefault();
        wrap.scrollLeft = 0;
        return true;
      case 'End':
        if (!hasX) return false;
        e.preventDefault();
        wrap.scrollLeft = wrap.scrollWidth;
        return true;
      case 'PageUp':
        if (e.shiftKey && hasX) {
          e.preventDefault();
          wrap.scrollLeft -= pageX;
          return true;
        }
        if (allowVertical && hasY) {
          e.preventDefault();
          wrap.scrollTop -= pageY;
          return true;
        }
        return false;
      case 'PageDown':
        if (e.shiftKey && hasX) {
          e.preventDefault();
          wrap.scrollLeft += pageX;
          return true;
        }
        if (allowVertical && hasY) {
          e.preventDefault();
          wrap.scrollTop += pageY;
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  function initGlobalHoverKeyHandler() {
    if (document.documentElement.dataset.hscrollHoverKeyInit === '1') return;
    document.documentElement.dataset.hscrollHoverKeyInit = '1';

    window.addEventListener('keydown', (e) => {
      if (!hoveredWrap) return;

      if (isEditableElement(document.activeElement)) return;

      const active = document.activeElement;
      if (active && hoveredWrap.contains(active)) return;

      if (isInteractiveTarget(e.target)) return;

      handleScrollKeys(hoveredWrap, e, false);
    }, true);
  }

  function initWrapper(wrap) {
    if (wrap.dataset.hscrollInit === '1') return;
    wrap.dataset.hscrollInit = '1';

    if (!wrap.hasAttribute('tabindex')) wrap.setAttribute('tabindex', '0');

    wrap.addEventListener('mouseenter', () => {
      hoveredWrap = wrap;
    });

    wrap.addEventListener('mouseleave', () => {
      if (hoveredWrap === wrap) hoveredWrap = null;
    });

    wrap.addEventListener('wheel', (e) => {
      const hasX = canScrollX(wrap);
      const hasY = canScrollY(wrap);
      if (!hasX && !hasY) return;

      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      const mode = (wrap.getAttribute('data-wheel-mode') || 'smart').toLowerCase();

      if (hasX && absX > absY && absX > 0) {
        e.preventDefault();
        wrap.scrollLeft += e.deltaX;
        return;
      }

      if (hasX && e.shiftKey && absY > 0) {
        e.preventDefault();
        wrap.scrollLeft += e.deltaY;
        return;
      }

      if (hasX && absY > 0) {
        if (mode === 'always') {
          e.preventDefault();
          wrap.scrollLeft += e.deltaY;
          return;
        }

        if (mode === 'edge') {
          const atTop = wrap.scrollTop <= 0;
          const atBottom = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 1;
          if (!hasY || atTop || atBottom) {
            e.preventDefault();
            wrap.scrollLeft += e.deltaY;
            return;
          }
        }
      }
    }, { passive: false });

    wrap.addEventListener('keydown', (e) => {
      handleScrollKeys(wrap, e, true);
    });

    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let pointerId = null;

    wrap.addEventListener('pointerdown', (e) => {
      if (!isInteractiveTarget(e.target) && e.button === 0) {
        try { wrap.focus({ preventScroll: true }); } catch { wrap.focus(); }
      }

      if (isInteractiveTarget(e.target)) return;

      const isMiddle = e.button === 1;
      const isAltLeft = e.button === 0 && e.altKey;

      if (!isMiddle && !isAltLeft) return;

      isPanning = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = wrap.scrollLeft;
      startTop = wrap.scrollTop;

      wrap.classList.add('is-dragging');
      wrap.setPointerCapture(pointerId);
      e.preventDefault();
    });

    wrap.addEventListener('pointermove', (e) => {
      if (!isPanning || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      wrap.scrollLeft = startLeft - dx;
      wrap.scrollTop = startTop - dy;
    });

    function endPan() {
      if (!isPanning) return;
      isPanning = false;
      pointerId = null;
      wrap.classList.remove('is-dragging');
    }

    wrap.addEventListener('pointerup', endPan);
    wrap.addEventListener('pointercancel', endPan);
    wrap.addEventListener('lostpointercapture', endPan);
  }

  CollectionTable.scroll = {
    initInputModalityTracker,
    initGlobalHoverKeyHandler,
    initWrapper
  };
})();
