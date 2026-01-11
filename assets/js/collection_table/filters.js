(() => {
  const CollectionTable = window.CollectionTable || (window.CollectionTable = {});
  CollectionTable._modules = CollectionTable._modules || {};
  if (CollectionTable._modules.filters) return;
  CollectionTable._modules.filters = true;

  const {
    escapeHtml,
    normalizeList,
    normalizeNumber,
    parseFilterList,
    getTableRows,
    getLowerText,
    formatStars,
    hasActiveFilters
  } = CollectionTable.utils;

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
      if (filters.stars === 'none') {
        pills.push({
          type: 'stars',
          value: 'none',
          label: 'No Stars'
        });
      } else {
        pills.push({
          type: 'stars',
          value: String(filters.stars),
          label: `+${formatStars(filters.stars)} Stars`
        });
      }
    }

    if (filters.yearFrom !== null) {
      let label = String(filters.yearFrom);
      if (filters.yearTo !== null && filters.yearTo !== filters.yearFrom) {
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
      parts.push(`Showing ${count} result(s)`);
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
      if (stars === 'none') {
        matches = rowStars < 1;
      } else {
        matches = rowStars >= stars;
      }
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

  function updateFilters(collection, updates) {
    const state = CollectionTable.getState(collection);
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
      filters.stars = updates.stars === 'none' ? 'none' : normalizeNumber(updates.stars);
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
    } else if ('yearFrom' in updates && !('yearTo' in updates)) {
      filters.yearTo = filters.yearFrom;
    }

    applyFilters(state);
  }

  function clearAllFilters(collection, options = {}) {
    const state = CollectionTable.getState(collection);
    const resetSort = options.resetSort !== false;
    const focusInput = options.focusInput !== false;

    if (state.filterTimeout) {
      clearTimeout(state.filterTimeout);
      state.filterTimeout = null;
    }

    state.filters = CollectionTable.getDefaultFilters();

    if (resetSort) {
      CollectionTable.sorting.resetSortState(state, true);
    }

    applyFilters(state);

    if (focusInput && state.filterInput) {
      state.filterInput.focus();
    }
  }

  function registerAdvancedSync(collection, callback) {
    const state = CollectionTable.getState(collection);
    state.advancedSync = callback;
    if (typeof callback === 'function') {
      callback(state);
    }
  }

  CollectionTable.filters = {
    applyFilters,
    updateSortInfo,
    renderPills,
    buildPills,
    getSortDisplayLabel
  };

  CollectionTable.updateFilters = updateFilters;
  CollectionTable.clearAllFilters = clearAllFilters;
  CollectionTable.registerAdvancedSync = registerAdvancedSync;
})();
