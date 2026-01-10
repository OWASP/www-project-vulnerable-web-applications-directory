(() => {
  if (window.CollectionTable && window.CollectionTable.__initialized) {
    return;
  }
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

  // Filtering and Sorting functionality
  const FILTER_DEBOUNCE_MS = 300;
  const collectionStates = new Map();

  function getDefaultFilters() {
    return {
      query: '',
      techs: [],
      refs: [],
      stars: null,
      yearFrom: null,
      yearTo: null,
      techMatch: 'or',
      refMatch: 'or'
    };
  }

  function getState(collection) {
    let state = collectionStates.get(collection);
    if (!state) {
      state = {
        collection,
        wrapper: null,
        filterInput: null,
        clearButton: null,
        sortInfo: null,
        pillContainers: [],
        originalRows: [],
        filterTimeout: null,
        visibleCount: 0,
        filters: getDefaultFilters(),
        sort: {
          columnIndex: null,
          direction: null,
          mode: 'text',
          clickCount: 0,
          columnName: null,
          displayLabel: null
        },
        sortHeaders: [],
        advancedSync: null
      };
      collectionStates.set(collection, state);
    }
    return state;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeList(values) {
    if (!Array.isArray(values)) return [];
    return values.map(value => String(value).trim()).filter(Boolean);
  }

  function normalizeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getTableRows(wrapper) {
    const table = wrapper.querySelector('table');
    if (!table) return [];
    const rows = Array.from(table.querySelectorAll('tr'));
    // Skip header row
    return rows.slice(1);
  }

  function getLowerText(element) {
    if (!element) return '';
    return element.textContent.trim().toLowerCase();
  }

  function parseFilterList(value) {
    if (!value) return [];
    return value.split('|').map(item => item.trim().toLowerCase()).filter(Boolean);
  }

  function hasActiveFilters(filters) {
    return Boolean(
      filters.query ||
      filters.techs.length ||
      filters.refs.length ||
      filters.stars !== null ||
      filters.yearFrom !== null ||
      filters.yearTo !== null
    );
  }

  function formatStars(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number.toLocaleString('en-US');
  }

  function buildPills(filters) {
    const pills = [];

    if (filters.query) {
      pills.push({
        type: 'query',
        value: filters.query,
        label: filters.query
      });
    }

    filters.techs.forEach(value => {
      pills.push({
        type: 'tech',
        value,
        label: value
      });
    });

    filters.refs.forEach(value => {
      pills.push({
        type: 'refs',
        value,
        label: value
      });
    });

    if (filters.stars !== null) {
      pills.push({
        type: 'stars',
        value: String(filters.stars),
        label: `+${formatStars(filters.stars)} Stars`
      });
    }

    if (filters.yearFrom !== null) {
      let label = String(filters.yearFrom);
      if (filters.yearTo !== null) {
        const minYear = Math.min(filters.yearFrom, filters.yearTo);
        const maxYear = Math.max(filters.yearFrom, filters.yearTo);
        label = `${minYear}-${maxYear}`;
      }
      pills.push({
        type: 'year',
        value: label,
        label
      });
    }

    return pills;
  }

  function renderPills(state) {
    if (!state.pillContainers.length) return;
    const pills = buildPills(state.filters);
    const html = pills.map(pill => {
      const label = escapeHtml(pill.label);
      const value = escapeHtml(pill.value);
      return (
        `<button type="button" class="filter-pill" data-pill-type="${pill.type}" data-pill-value="${value}"` +
        ` aria-label="Remove ${label} filter">` +
        `${label}<span class="pill-remove" aria-hidden="true">x</span></button>`
      );
    }).join('');

    state.pillContainers.forEach(container => {
      container.innerHTML = html;
    });
  }

  function syncMainInput(state) {
    if (!state.filterInput) return;
    if (state.filterInput.value !== state.filters.query) {
      state.filterInput.value = state.filters.query;
    }
  }

  function updateSortInfo(state) {
    if (!state.sortInfo) return;
    const filters = state.filters;
    const parts = [];

    if (state.sort.columnName && state.sort.direction) {
      const directionText = state.sort.direction === 'asc' ? 'ascending' : 'descending';
      const label = state.sort.displayLabel || getSortDisplayLabel(state.sort.columnName, state.sort.mode);
      parts.push(`Sorted by ${label} (${directionText})`);
    }

    if (hasActiveFilters(filters)) {
      const count = state.visibleCount || 0;
      if (filters.query) {
        parts.push(`Showing ${count} result(s) for "${filters.query}"`);
      } else {
        parts.push(`Showing ${count} result(s)`);
      }
    }

    state.sortInfo.textContent = parts.join(' | ');
  }

  function getSortDisplayLabel(columnName, mode) {
    if (!columnName) return '';
    if (columnName === 'App. URL') {
      if (mode === 'numeric') return 'Stars';
      if (mode === 'text') return 'Name';
    }
    if (columnName === 'Note(s)') {
      if (mode === 'date') return 'Last Commit';
      if (mode === 'text') return 'Notes';
    }
    return columnName;
  }

  function applyFilters(state) {
    if (!state.wrapper) return;
    const rows = getTableRows(state.wrapper);
    const filters = state.filters;
    const query = filters.query.trim().toLowerCase();
    const techs = filters.techs.map(value => value.toLowerCase());
    const refs = filters.refs.map(value => value.toLowerCase());
    const stars = filters.stars;
    const yearFrom = filters.yearFrom;
    const yearTo = filters.yearTo;
    const techAnd = filters.techMatch === 'and';
    const refsAnd = filters.refMatch === 'and';
    let visibleCount = 0;

    rows.forEach(row => {
      let matches = true;

      if (query) {
        const rowText = getLowerText(row);
        if (!rowText.includes(query)) {
          matches = false;
        }
      }

      if (matches && techs.length) {
        const rowTechs = parseFilterList(row.getAttribute('data-filter-tech'));
        matches = techAnd
          ? techs.every(value => rowTechs.includes(value))
          : techs.some(value => rowTechs.includes(value));
      }

      if (matches && refs.length) {
        const rowRefs = parseFilterList(row.getAttribute('data-filter-refs'));
        matches = refsAnd
          ? refs.every(value => rowRefs.includes(value))
          : refs.some(value => rowRefs.includes(value));
      }

      if (matches && stars !== null) {
        const rowStars = parseInt(row.getAttribute('data-filter-stars') || '0', 10);
        matches = rowStars >= stars;
      }

      if (matches && yearFrom !== null) {
        const rowYear = parseInt(row.getAttribute('data-filter-year') || '', 10);
        if (!rowYear) {
          matches = false;
        } else if (yearTo !== null) {
          const minYear = Math.min(yearFrom, yearTo);
          const maxYear = Math.max(yearFrom, yearTo);
          matches = rowYear >= minYear && rowYear <= maxYear;
        } else {
          matches = rowYear === yearFrom;
        }
      }

      row.classList.toggle('filtered-out', !matches);
      if (matches) visibleCount += 1;
    });

    state.visibleCount = visibleCount;
    syncMainInput(state);
    renderPills(state);
    updateSortInfo(state);

    if (typeof state.advancedSync === 'function') {
      state.advancedSync(state);
    }
  }

  function sortTable(wrapper, columnIndex, direction, sortMode = 'text') {
    const table = wrapper.querySelector('table');
    if (!table) return;

    const tbody = table.querySelector('tbody') || table;
    const rows = getTableRows(wrapper);
    const header = wrapper.querySelector(`th[data-column="${columnIndex}"]`);
    const isDualSort = header && header.classList.contains('dual-sort');

    const sortedRows = rows.sort((a, b) => {
      const cellA = a.querySelectorAll('td')[columnIndex];
      const cellB = b.querySelectorAll('td')[columnIndex];

      let valueA;
      let valueB;

      if (isDualSort && sortMode === 'date') {
        valueA = cellA.getAttribute('data-sort-value-date') || '';
        valueB = cellB.getAttribute('data-sort-value-date') || '';

        const dateA = (valueA === '') ? new Date(0) : new Date(valueA);
        const dateB = (valueB === '') ? new Date(0) : new Date(valueB);

        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

      if (isDualSort && sortMode === 'numeric') {
        valueA = cellA.getAttribute('data-sort-value-numeric') || '0';
        valueB = cellB.getAttribute('data-sort-value-numeric') || '0';

        const numA = parseInt(valueA, 10);
        const numB = parseInt(valueB, 10);

        return direction === 'asc' ? numA - numB : numB - numA;
      }

      if (isDualSort && sortMode === 'text') {
        valueA = cellA.getAttribute('data-sort-value-text') || '';
        valueB = cellB.getAttribute('data-sort-value-text') || '';

        return direction === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }

      const textA = getLowerText(cellA);
      const textB = getLowerText(cellB);

      return direction === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA);
    });

    sortedRows.forEach(row => {
      tbody.appendChild(row);
    });
  }

  function resetTableOrder(wrapper, originalRows) {
    const table = wrapper.querySelector('table');
    if (!table) return;

    const tbody = table.querySelector('tbody') || table;
    const currentRows = getTableRows(wrapper);

    currentRows.forEach(row => row.remove());

    originalRows.forEach(row => {
      tbody.appendChild(row.cloneNode(true));
    });
  }

  function resetSortState(state, resetOrder) {
    if (state.sortHeaders.length) {
      state.sortHeaders.forEach(header => {
        header.setAttribute('aria-sort', 'none');
        const modeIndicator = header.querySelector('.sort-mode-indicator');
        if (modeIndicator) {
          modeIndicator.textContent = '';
        }
      });
    }

    if (resetOrder && state.wrapper && state.originalRows.length) {
      resetTableOrder(state.wrapper, state.originalRows);
    }

    state.sort = {
      columnIndex: null,
      direction: null,
      mode: 'text',
      clickCount: 0,
      columnName: null,
      displayLabel: null
    };
  }

  function updateFilters(collection, updates) {
    const state = getState(collection);
    const filters = state.filters;

    if ('query' in updates) {
      const rawQuery = updates.query;
      filters.query = rawQuery === null || rawQuery === undefined ? '' : String(rawQuery).trim();
    }

    if ('techs' in updates) {
      filters.techs = normalizeList(updates.techs);
    }

    if ('refs' in updates) {
      filters.refs = normalizeList(updates.refs);
    }

    if ('stars' in updates) {
      filters.stars = normalizeNumber(updates.stars);
    }

    if ('yearFrom' in updates) {
      filters.yearFrom = normalizeNumber(updates.yearFrom);
    }

    if ('yearTo' in updates) {
      filters.yearTo = normalizeNumber(updates.yearTo);
    }

    if ('techMatch' in updates) {
      filters.techMatch = updates.techMatch === 'and' ? 'and' : 'or';
    }

    if ('refMatch' in updates) {
      filters.refMatch = updates.refMatch === 'and' ? 'and' : 'or';
    }

    if (filters.yearFrom === null) {
      filters.yearTo = null;
    }

    applyFilters(state);
  }

  function clearAllFilters(collection, options = {}) {
    const state = getState(collection);
    const resetSort = options.resetSort !== false;
    const focusInput = options.focusInput !== false;

    if (state.filterTimeout) {
      clearTimeout(state.filterTimeout);
      state.filterTimeout = null;
    }

    state.filters = getDefaultFilters();

    if (resetSort) {
      resetSortState(state, true);
    }

    applyFilters(state);

    if (focusInput && state.filterInput) {
      state.filterInput.focus();
    }
  }

  function registerAdvancedSync(collection, callback) {
    const state = getState(collection);
    state.advancedSync = callback;
    if (typeof callback === 'function') {
      callback(state);
    }
  }

  function initFilteringSorting(wrapper) {
    const collection = wrapper.getAttribute('data-collection');

    if (collection === 'aotd') return;
    if (wrapper.dataset.filterInit === '1') return;
    wrapper.dataset.filterInit = '1';

    const state = getState(collection);
    state.wrapper = wrapper;

    const filterInput = document.getElementById(`filter-input-${collection}`);
    if (!filterInput) return;

    const controlsDiv = filterInput.closest('.collection-controls');
    if (!controlsDiv) return;

    const clearButton = controlsDiv.querySelector('.clear-filter');
    const sortInfo = controlsDiv.querySelector('.sort-info');
    const pillContainers = Array.from(document.querySelectorAll(`.filter-pills[data-collection="${collection}"]`));

    state.filterInput = filterInput;
    state.clearButton = clearButton;
    state.sortInfo = sortInfo;
    state.pillContainers = pillContainers;

    const table = wrapper.querySelector('table');
    state.originalRows = table ? Array.from(getTableRows(wrapper)).map(row => row.cloneNode(true)) : [];

    if (filterInput.dataset.filterInit !== '1') {
      filterInput.dataset.filterInit = '1';
      filterInput.addEventListener('input', (event) => {
        clearTimeout(state.filterTimeout);
        const value = event.target.value;
        state.filterTimeout = setTimeout(() => {
          updateFilters(collection, { query: value });
        }, FILTER_DEBOUNCE_MS);
      });
    }

    if (clearButton && clearButton.dataset.clearInit !== '1') {
      clearButton.dataset.clearInit = '1';
      clearButton.addEventListener('click', () => {
        clearAllFilters(collection, { resetSort: true, focusInput: true });
      });
    }

    pillContainers.forEach(container => {
      if (container.dataset.pillInit === '1') return;
      container.dataset.pillInit = '1';
      container.addEventListener('click', (event) => {
        const pill = event.target.closest('.filter-pill');
        if (!pill) return;
        const type = pill.getAttribute('data-pill-type');
        const value = pill.getAttribute('data-pill-value') || '';
        const current = state.filters;

        if (type === 'query') {
          updateFilters(collection, { query: '' });
          return;
        }

        if (type === 'tech') {
          const nextTechs = current.techs.filter(item => item.toLowerCase() !== value.toLowerCase());
          updateFilters(collection, { techs: nextTechs });
          return;
        }

        if (type === 'refs') {
          const nextRefs = current.refs.filter(item => item.toLowerCase() !== value.toLowerCase());
          updateFilters(collection, { refs: nextRefs });
          return;
        }

        if (type === 'stars') {
          updateFilters(collection, { stars: null });
          return;
        }

        if (type === 'year') {
          updateFilters(collection, { yearFrom: null, yearTo: null });
        }
      });
    });

    const sortableHeaders = Array.from(wrapper.querySelectorAll('th.sortable'));
    state.sortHeaders = sortableHeaders;

    sortableHeaders.forEach(header => {
      if (header.dataset.sortInit === '1') return;
      header.dataset.sortInit = '1';
      const handleSort = () => {
        const columnIndex = parseInt(header.getAttribute('data-column'), 10);
        const isDualSort = header.classList.contains('dual-sort');
        const columnName = header.getAttribute('data-column-name') || '';
        const sortState = state.sort;

        let newDirection = null;
        let newMode = 'text';

        if (sortState.columnIndex === columnIndex) {
          sortState.clickCount += 1;

          if (isDualSort) {
            const cyclePosition = sortState.clickCount % 5;
            const isAppUrlColumn = columnName === 'App. URL';
            const isNotesColumn = columnName === 'Note(s)';

            if (cyclePosition === 1) {
              newDirection = 'asc';
              newMode = isAppUrlColumn ? 'numeric' : 'date';
            } else if (cyclePosition === 2) {
              newDirection = 'desc';
              newMode = isAppUrlColumn ? 'numeric' : 'date';
            } else if (cyclePosition === 3) {
              newDirection = 'asc';
              newMode = 'text';
            } else if (cyclePosition === 4) {
              newDirection = 'desc';
              newMode = 'text';
            } else {
              newDirection = null;
              newMode = 'text';
              sortState.clickCount = 0;
            }
          } else {
            if (sortState.direction === 'asc') {
              newDirection = 'desc';
            } else if (sortState.direction === 'desc') {
              newDirection = null;
            } else {
              newDirection = 'asc';
            }
          }
        } else {
          newDirection = 'asc';
          sortState.clickCount = 1;
          const isAppUrlColumn = columnName === 'App. URL';
          const isNotesColumn = columnName === 'Note(s)';
          newMode = (isDualSort && (isAppUrlColumn || isNotesColumn))
            ? (isAppUrlColumn ? 'numeric' : 'date')
            : 'text';
        }

        sortableHeaders.forEach(item => {
          item.setAttribute('aria-sort', 'none');
          const modeIndicator = item.querySelector('.sort-mode-indicator');
          if (modeIndicator) {
            modeIndicator.textContent = '';
          }
        });

        if (newDirection) {
          sortTable(wrapper, columnIndex, newDirection, newMode);
          header.setAttribute('aria-sort', newDirection === 'asc' ? 'ascending' : 'descending');

          sortState.columnIndex = columnIndex;
          sortState.direction = newDirection;
          sortState.mode = newMode;
          sortState.columnName = columnName;
          sortState.displayLabel = isDualSort ? getSortDisplayLabel(columnName, newMode) : columnName;

          if (isDualSort) {
            const modeIndicator = header.querySelector('.sort-mode-indicator');
            if (modeIndicator) {
              const isAppUrlColumn = columnName === 'App. URL';
              const isNotesColumn = columnName === 'Note(s)';

              if (isAppUrlColumn) {
                modeIndicator.textContent = `(sorting by ${newMode === 'numeric' ? 'stars' : 'name'})`;
              } else if (isNotesColumn) {
                modeIndicator.textContent = `(sorting by ${newMode === 'date' ? 'last commit' : 'notes'})`;
              }
            }
          }

          updateSortInfo(state);
        } else {
          resetSortState(state, true);
          applyFilters(state);
        }
      };

      header.addEventListener('click', handleSort);
      header.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleSort();
        }
      });
    });

    const totalRows = getTableRows(wrapper).length;
    state.visibleCount = totalRows;
    applyFilters(state);
  }

  window.CollectionTable = {
    updateFilters,
    clearAllFilters,
    registerAdvancedSync,
    getState,
    __initialized: true
  };

  function initAll() {
    initInputModalityTracker();
    initGlobalHoverKeyHandler();
    document.querySelectorAll(WRAPPER_SELECTOR).forEach(wrapper => {
      initWrapper(wrapper);
      initFilteringSorting(wrapper);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll, { once: true });
  } else {
    initAll();
  }
})();
