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

  // Filtering and Sorting functionality
  const FILTER_DEBOUNCE_MS = 300;

  function getTableRows(wrapper) {
    const table = wrapper.querySelector('table');
    if (!table) return [];
    const rows = Array.from(table.querySelectorAll('tr'));
    // Skip header row
    return rows.slice(1);
  }

  function getTextContent(cell) {
    if (!cell) return '';
    // Get all text, including from nested elements
    return cell.textContent.trim().toLowerCase();
  }

  function filterTable(wrapper, filterText) {
    const rows = getTableRows(wrapper);
    let visibleCount = 0;

    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const rowText = cells.map(cell => getTextContent(cell)).join(' ');
      
      if (rowText.includes(filterText.toLowerCase())) {
        row.classList.remove('filtered-out');
        visibleCount++;
      } else {
        row.classList.add('filtered-out');
      }
    });

    return visibleCount;
  }

  function sortTable(wrapper, columnIndex, direction, sortMode = 'text') {
    const table = wrapper.querySelector('table');
    if (!table) return;

    const tbody = table.querySelector('tbody') || table;
    const rows = getTableRows(wrapper);
    
    // Determine the sort type based on column name
    const header = wrapper.querySelector(`th[data-column="${columnIndex}"]`);
    const columnName = header ? header.getAttribute('data-column-name') : '';
    const isDualSort = header && header.classList.contains('dual-sort');
    
    const sortedRows = rows.sort((a, b) => {
      const cellA = a.querySelectorAll('td')[columnIndex];
      const cellB = b.querySelectorAll('td')[columnIndex];
      
      let valueA, valueB;
      
      if (isDualSort && sortMode === 'date') {
        // For dual-sort columns in date mode, use data-sort-value-date
        valueA = cellA.getAttribute('data-sort-value-date') || '';
        valueB = cellB.getAttribute('data-sort-value-date') || '';
        
        // Treat empty as oldest date
        const dateA = (valueA === '') ? new Date(0) : new Date(valueA);
        const dateB = (valueB === '') ? new Date(0) : new Date(valueB);
        
        if (direction === 'asc') {
          return dateA - dateB;
        } else {
          return dateB - dateA;
        }
      } else if (isDualSort && sortMode === 'numeric') {
        // For dual-sort columns in numeric mode, use data-sort-value-numeric
        valueA = cellA.getAttribute('data-sort-value-numeric') || '0';
        valueB = cellB.getAttribute('data-sort-value-numeric') || '0';
        
        const numA = parseInt(valueA, 10);
        const numB = parseInt(valueB, 10);
        
        if (direction === 'asc') {
          return numA - numB;
        } else {
          return numB - numA;
        }
      } else if (isDualSort && sortMode === 'text') {
        // For dual-sort columns in text mode, use data-sort-value-text
        valueA = cellA.getAttribute('data-sort-value-text') || '';
        valueB = cellB.getAttribute('data-sort-value-text') || '';
        
        if (direction === 'asc') {
          return valueA.localeCompare(valueB);
        } else {
          return valueB.localeCompare(valueA);
        }
      } else {
        // For regular text columns, use localeCompare
        const textA = getTextContent(cellA);
        const textB = getTextContent(cellB);
        
        if (direction === 'asc') {
          return textA.localeCompare(textB);
        } else {
          return textB.localeCompare(textA);
        }
      }
    });

    // Re-append rows in sorted order
    sortedRows.forEach(row => {
      tbody.appendChild(row);
    });
  }

  function initFilteringSorting(wrapper) {
    const collection = wrapper.getAttribute('data-collection');
    
    // Skip if this is the "aotd" collection
    if (collection === 'aotd') return;

    // Find the filter input and clear button for this specific collection
    const filterInput = document.getElementById(`filter-input-${collection}`);
    const clearButton = filterInput ? filterInput.nextElementSibling : null;
    
    if (!filterInput || !clearButton) return;

    // Find the sort-info element for this collection (look for it in the DOM before this wrapper)
    const controlsDiv = filterInput.closest('.collection-controls');
    const sortInfo = controlsDiv ? controlsDiv.querySelector('.sort-info') : null;

    // Store original row order for reset functionality
    const table = wrapper.querySelector('table');
    const originalRows = table ? Array.from(getTableRows(wrapper)).map(row => row.cloneNode(true)) : [];

    // Setup filtering
    let filterTimeout;
    let hasActiveFilter = false;

    filterInput.addEventListener('input', (e) => {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(() => {
        const visibleCount = filterTable(wrapper, e.target.value);
        hasActiveFilter = e.target.value.trim().length > 0;
        updateFilterInfo(sortInfo, e.target.value, visibleCount);
      }, FILTER_DEBOUNCE_MS);
    });

    clearButton.addEventListener('click', () => {
      filterInput.value = '';
      hasActiveFilter = false;
      filterTable(wrapper, '');
      updateFilterInfo(sortInfo, '', getTableRows(wrapper).length);
      filterInput.focus();
    });

    // Setup sorting
    const sortableHeaders = wrapper.querySelectorAll('th.sortable');
    let currentSortColumn = null;
    let currentSortDirection = null;
    let currentSortMode = 'text'; // For dual-sort columns
    let sortClickCount = 0; // Track clicks for dual-sort columns

    sortableHeaders.forEach(header => {
      const handleSort = () => {
        const columnIndex = parseInt(header.getAttribute('data-column'), 10);
        const isDualSort = header.classList.contains('dual-sort');
        const columnName = header.getAttribute('data-column-name');
        
        // Determine new sort direction and mode
        let newDirection;
        let newMode = 'text';
        
        if (currentSortColumn === columnIndex) {
          sortClickCount++;
          
          if (isDualSort) {
            // 5-click dual-sort behavior
            const cyclePosition = sortClickCount % 5;
            
            // Determine which type of data to sort by first
            const isAppUrlColumn = columnName === 'App. URL';
            const isNotesColumn = columnName === 'Note(s)';
            
            if (cyclePosition === 1) {
              // First click: sort by secondary data (stars or last commit) ascending
              newDirection = 'asc';
              newMode = isAppUrlColumn ? 'numeric' : 'date';
            } else if (cyclePosition === 2) {
              // Second click: sort by secondary data descending
              newDirection = 'desc';
              newMode = isAppUrlColumn ? 'numeric' : 'date';
            } else if (cyclePosition === 3) {
              // Third click: sort by primary data (name or notes) ascending
              newDirection = 'asc';
              newMode = 'text';
            } else if (cyclePosition === 4) {
              // Fourth click: sort by primary data descending
              newDirection = 'desc';
              newMode = 'text';
            } else { // cyclePosition === 0
              // Fifth click: reset
              newDirection = null;
              newMode = 'text';
              sortClickCount = 0; // Reset counter
            }
          } else {
            // Regular 3-click behavior
            if (currentSortDirection === 'asc') {
              newDirection = 'desc';
            } else if (currentSortDirection === 'desc') {
              newDirection = null; // Reset to unsorted
            } else {
              newDirection = 'asc';
            }
          }
        } else {
          newDirection = 'asc';
          sortClickCount = 1;
          // Determine starting mode based on column type
          const isAppUrlColumn = columnName === 'App. URL';
          const isNotesColumn = columnName === 'Note(s)';
          newMode = (isDualSort && (isAppUrlColumn || isNotesColumn)) 
            ? (isAppUrlColumn ? 'numeric' : 'date') 
            : 'text';
        }

        // Clear all sort indicators
        sortableHeaders.forEach(h => {
          h.setAttribute('aria-sort', 'none');
          // Clear sort mode indicator
          const modeIndicator = h.querySelector('.sort-mode-indicator');
          if (modeIndicator) {
            modeIndicator.textContent = '';
          }
        });

        if (newDirection) {
          sortTable(wrapper, columnIndex, newDirection, newMode);
          header.setAttribute('aria-sort', newDirection === 'asc' ? 'ascending' : 'descending');
          currentSortColumn = columnIndex;
          currentSortDirection = newDirection;
          currentSortMode = newMode;
          
          // Update mode indicator for dual-sort columns
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
          
          updateSortInfo(sortInfo, columnName, newDirection, hasActiveFilter);
        } else {
          // Reset to original order by restoring the original rows
          resetTableOrder(wrapper, originalRows);
          currentSortColumn = null;
          currentSortDirection = null;
          currentSortMode = 'text';
          updateSortInfo(sortInfo, null, null, hasActiveFilter);
        }
      };

      header.addEventListener('click', handleSort);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSort();
        }
      });
    });
  }

  function resetTableOrder(wrapper, originalRows) {
    const table = wrapper.querySelector('table');
    if (!table) return;

    const tbody = table.querySelector('tbody') || table;
    const currentRows = getTableRows(wrapper);
    
    // Remove all current data rows
    currentRows.forEach(row => row.remove());
    
    // Re-append original rows (cloned to avoid reference issues)
    originalRows.forEach(row => {
      tbody.appendChild(row.cloneNode(true));
    });
  }

  function updateFilterInfo(sortInfoElement, filterText, visibleCount) {
    if (!sortInfoElement) return;

    if (filterText) {
      sortInfoElement.textContent = `Showing ${visibleCount} result(s) for "${filterText}"`;
    } else {
      sortInfoElement.textContent = '';
    }
  }

  function updateSortInfo(sortInfoElement, columnName, direction, hasActiveFilter) {
    if (!sortInfoElement) return;

    if (columnName && direction) {
      const directionText = direction === 'asc' ? 'ascending' : 'descending';
      const baseText = `Sorted by ${columnName} (${directionText})`;
      sortInfoElement.textContent = baseText;
    } else {
      // Only clear if there's no active filter
      if (!hasActiveFilter) {
        sortInfoElement.textContent = '';
      }
    }
  }

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
