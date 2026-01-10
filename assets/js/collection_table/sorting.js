(() => {
  const CollectionTable = window.CollectionTable || (window.CollectionTable = {});
  CollectionTable._modules = CollectionTable._modules || {};
  if (CollectionTable._modules.sorting) return;
  CollectionTable._modules.sorting = true;

  const { getTableRows, getLowerText } = CollectionTable.utils;

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

  CollectionTable.sorting = {
    sortTable,
    resetSortState,
    resetTableOrder
  };
})();
