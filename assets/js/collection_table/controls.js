(() => {
  const CollectionTable = window.CollectionTable || (window.CollectionTable = {});
  CollectionTable._modules = CollectionTable._modules || {};
  if (CollectionTable._modules.controls) return;
  CollectionTable._modules.controls = true;

  const FILTER_DEBOUNCE_MS = 300;

  function initFilteringSorting(wrapper) {
    const collection = wrapper.getAttribute('data-collection');

    if (collection === 'aotd') return;
    if (wrapper.dataset.filterInit === '1') return;
    wrapper.dataset.filterInit = '1';

    const state = CollectionTable.getState(collection);
    state.wrapper = wrapper;

    const filterInput = document.getElementById(`filter-input-${collection}`);
    if (!filterInput) return;

    const controlsDiv = filterInput.closest('.collection-controls');
    if (!controlsDiv) return;

    const clearButton = controlsDiv.querySelector('.clear-filter');
    const sortInfo = controlsDiv.querySelector('.sort-info');
    const pillContainers = Array.from(
      document.querySelectorAll(`.filter-pills[data-collection="${collection}"]:not([data-pill-scope="modal"])`)
    );

    state.filterInput = filterInput;
    state.clearButton = clearButton;
    state.sortInfo = sortInfo;
    state.pillContainers = pillContainers;

    const table = wrapper.querySelector('table');
    state.originalRows = table
      ? Array.from(CollectionTable.utils.getTableRows(wrapper)).map(row => row.cloneNode(true))
      : [];

    if (filterInput.dataset.filterInit !== '1') {
      filterInput.dataset.filterInit = '1';
      filterInput.addEventListener('input', (event) => {
        clearTimeout(state.filterTimeout);
        const value = event.target.value;
        state.filterTimeout = setTimeout(() => {
          CollectionTable.updateFilters(collection, { query: value });
        }, FILTER_DEBOUNCE_MS);
      });
    }

    if (clearButton && clearButton.dataset.clearInit !== '1') {
      clearButton.dataset.clearInit = '1';
      clearButton.addEventListener('click', () => {
        CollectionTable.clearAllFilters(collection, { resetSort: true, focusInput: false });
      });
    }

    pillContainers.forEach(container => {
      if (container.dataset.pillInit === '1') return;
      container.dataset.pillInit = '1';
      container.addEventListener('click', (event) => {
        const pill = event.target.closest('.filter-pill');
        if (!pill) return;
        const type = pill.getAttribute('data-pill-type');

        if (type === 'query') {
          CollectionTable.updateFilters(collection, { query: '' });
          return;
        }

        if (type === 'tech') {
          const updated = state.filters.techs.filter(item => item !== pill.getAttribute('data-pill-value'));
          CollectionTable.updateFilters(collection, { techs: updated });
          return;
        }

        if (type === 'refs') {
          const updated = state.filters.refs.filter(item => item !== pill.getAttribute('data-pill-value'));
          CollectionTable.updateFilters(collection, { refs: updated });
          return;
        }

        if (type === 'stars') {
          CollectionTable.updateFilters(collection, { stars: null });
          return;
        }

        if (type === 'year') {
          CollectionTable.updateFilters(collection, { yearFrom: null, yearTo: null });
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
          CollectionTable.sorting.sortTable(wrapper, columnIndex, newDirection, newMode);
          header.setAttribute('aria-sort', newDirection === 'asc' ? 'ascending' : 'descending');

          sortState.columnIndex = columnIndex;
          sortState.direction = newDirection;
          sortState.mode = newMode;
          sortState.columnName = columnName;
          sortState.displayLabel = isDualSort
            ? CollectionTable.filters.getSortDisplayLabel(columnName, newMode)
            : columnName;

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

          CollectionTable.filters.updateSortInfo(state);
        } else {
          CollectionTable.sorting.resetSortState(state, true);
          CollectionTable.filters.applyFilters(state);
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

    const totalRows = CollectionTable.utils.getTableRows(wrapper).length;
    state.visibleCount = totalRows;
    CollectionTable.filters.applyFilters(state);
  }

  CollectionTable.controls = {
    initFilteringSorting
  };
})();
