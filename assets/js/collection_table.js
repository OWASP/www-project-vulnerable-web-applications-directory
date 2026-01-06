(() => {
  const WRAPPER_SELECTOR = '.collection-table-wrapper';
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

  // ===== SEARCH/FILTER FUNCTIONALITY =====
  function initSearch() {
    const searchInput = document.getElementById('collection-table-search');
    const table = document.getElementById('collection-table');
    
    if (!searchInput || !table) return;

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const rows = table.querySelectorAll('tbody tr.table-row');

        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          if (text.includes(searchTerm)) {
            row.classList.remove('hidden');
          } else {
            row.classList.add('hidden');
          }
        });
      }, 150);
    });
  }

  // ===== SORTING FUNCTIONALITY =====
  function initSort() {
    const table = document.getElementById('collection-table');
    if (!table) return;

    const headers = table.querySelectorAll('th[data-column]');
    let currentSortColumn = null;
    let currentSortDirection = 'none';
    const cellCache = new WeakMap();

    function getCellValue(row, columnIndex) {
      const cell = row.children[columnIndex];
      if (!cell) return '';
      
      // Check cache first
      if (cellCache.has(cell)) {
        return cellCache.get(cell);
      }
      
      // Extract text content, ignoring images
      const text = Array.from(cell.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'IMG'))
        .map(node => node.textContent)
        .join(' ')
        .trim()
        .toLowerCase();
      
      // Cache the result
      cellCache.set(cell, text);
      return text;
    }

    function sortTable(columnIndex, direction) {
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr.table-row'));

      rows.sort((a, b) => {
        const aValue = getCellValue(a, columnIndex);
        const bValue = getCellValue(b, columnIndex);

        if (direction === 'ascending') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });

      // Re-append rows in sorted order
      rows.forEach(row => tbody.appendChild(row));
    }

    function updateSortIndicators(columnIndex, direction) {
      headers.forEach(header => {
        const col = parseInt(header.getAttribute('data-column'));
        if (col === columnIndex) {
          header.setAttribute('aria-sort', direction);
        } else {
          header.setAttribute('aria-sort', 'none');
        }
      });
    }

    headers.forEach(header => {
      header.addEventListener('click', () => {
        const columnIndex = parseInt(header.getAttribute('data-column'));
        
        let newDirection;
        if (currentSortColumn === columnIndex) {
          // Toggle direction
          if (currentSortDirection === 'none' || currentSortDirection === 'descending') {
            newDirection = 'ascending';
          } else {
            newDirection = 'descending';
          }
        } else {
          // New column, start with ascending
          newDirection = 'ascending';
        }

        currentSortColumn = columnIndex;
        currentSortDirection = newDirection;

        sortTable(columnIndex, newDirection);
        updateSortIndicators(columnIndex, newDirection);
      });

      // Add keyboard support for sorting
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });
    });
  }

  function initAll() {
    initInputModalityTracker();
    initGlobalHoverKeyHandler();
    document.querySelectorAll(WRAPPER_SELECTOR).forEach(initWrapper);
    initSearch();
    initSort();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll, { once: true });
  } else {
    initAll();
  }
})();
