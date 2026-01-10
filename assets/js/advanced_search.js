(() => {
  if (window.AdvancedSearchUI && window.AdvancedSearchUI.__initialized) {
    return;
  }
  window.AdvancedSearchUI = { __initialized: true };
  const MODAL_SELECTOR = '.advanced-search-modal';
  const OPEN_CLASS = 'is-open';
  const INPUT_DEBOUNCE_MS = 300;
  const FOCUSABLE_SELECTOR = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex=\"-1\"])';
  const PANEL_MIN_WIDTH = 80;
  const PANEL_MAX_WIDTH = 240;
  const PANEL_PADDING = 24;

  function getCollection(element) {
    return element ? element.getAttribute('data-collection') : '';
  }

  function closeAllPanels(modal) {
    modal.querySelectorAll('[data-multi-panel], [data-single-panel]').forEach(panel => {
      panel.hidden = true;
      delete panel.dataset.open;
    });
    modal.querySelectorAll('[data-multi-trigger], [data-single-trigger]').forEach(trigger => {
      trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function setPanelOpen(modal, type, open) {
    const panel = modal.querySelector(`[data-multi-panel="${type}"]`);
    const trigger = modal.querySelector(`[data-multi-trigger="${type}"]`);
    if (!panel || !trigger) return;
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      panel.dataset.open = '1';
      setPanelWidth(panel, trigger, 20);
      panel.focus();
    } else {
      delete panel.dataset.open;
    }
  }

  function setSinglePanelOpen(modal, type, open) {
    const panel = modal.querySelector(`[data-single-panel="${type}"]`);
    const trigger = modal.querySelector(`[data-single-trigger="${type}"]`);
    if (!panel || !trigger) return;
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      panel.dataset.open = '1';
      setPanelWidth(panel, trigger, 0);
      panel.focus();
    } else {
      delete panel.dataset.open;
    }
  }

  function getSelectedValues(modal, type) {
    return Array.from(modal.querySelectorAll(`[data-multi-option="${type}"]:checked`))
      .map(option => option.value);
  }

  function updateTriggerLabel(modal, type, values) {
    const trigger = modal.querySelector(`[data-multi-trigger="${type}"]`);
    if (!trigger) return;
    const defaultLabel = trigger.getAttribute('data-default-label') || 'Select options';

    if (!values.length) {
      trigger.textContent = defaultLabel;
      return;
    }

    if (values.length === 1) {
      trigger.textContent = values[0];
      return;
    }

    trigger.textContent = `${values.length} selected`;
  }

  function setPanelWidth(panel, trigger, extra) {
    if (!panel) return;
    const options = Array.from(panel.querySelectorAll('.multi-option, .single-option, .multi-select-ok'));
    let maxWidth = 0;
    options.forEach(option => {
      maxWidth = Math.max(maxWidth, option.scrollWidth);
    });
    const triggerWidth = trigger ? trigger.offsetWidth : 0;
    const minWidth = Math.max(PANEL_MIN_WIDTH, triggerWidth);
    const padding = PANEL_PADDING + (extra || 0);
    const width = Math.min(Math.max(maxWidth + padding, minWidth), PANEL_MAX_WIDTH);
    panel.style.width = `${width}px`;
  }

  function updateSingleTriggerLabel(modal, type, value) {
    const trigger = modal.querySelector(`[data-single-trigger="${type}"]`);
    if (!trigger) return;
    const defaultLabel = trigger.getAttribute('data-default-label') || '';
    const stringValue = value === null || value === undefined ? '' : String(value);
    if (!stringValue) {
      trigger.textContent = defaultLabel;
      return;
    }
    const option = modal.querySelector(`[data-single-option="${type}"][data-value="${stringValue}"]`);
    trigger.textContent = option ? option.textContent.trim() : defaultLabel;
  }

  function updateYearToOptions(modal, fromValue) {
    const panel = modal.querySelector('[data-single-panel="year-to"]');
    if (!panel) return;
    const stringValue = fromValue ? String(fromValue) : '';
    const options = Array.from(panel.querySelectorAll('[data-single-option="year-to"]'));
    options.forEach(option => {
      const value = option.getAttribute('data-value') || '';
      if (value === '') {
        option.hidden = false;
        option.disabled = false;
        option.classList.remove('is-disabled');
        option.style.display = '';
        return;
      }
      const shouldHide = !!stringValue && value === stringValue;
      option.hidden = shouldHide;
      option.style.display = shouldHide ? 'none' : '';
      option.disabled = false;
      option.classList.remove('is-disabled');
    });
  }

  function syncModalInputs(modal, state) {
    if (!modal || !state) return;
    const filters = state.filters;

    const searchInput = modal.querySelector('.advanced-search-input');
    if (searchInput && searchInput.value !== filters.query) {
      searchInput.value = filters.query;
    }

    const techValues = filters.techs.map(value => value.toLowerCase());
    modal.querySelectorAll('[data-multi-option="tech"]').forEach(option => {
      option.checked = techValues.includes(option.value.toLowerCase());
    });

    const refValues = filters.refs.map(value => value.toLowerCase());
    modal.querySelectorAll('[data-multi-option="refs"]').forEach(option => {
      option.checked = refValues.includes(option.value.toLowerCase());
    });

    const starsValue = filters.stars !== null ? String(filters.stars) : '';
    updateSingleTriggerLabel(modal, 'stars', starsValue);

    const yearFromValue = filters.yearFrom !== null ? String(filters.yearFrom) : '';
    const yearToValue = filters.yearTo !== null ? String(filters.yearTo) : '';
    updateSingleTriggerLabel(modal, 'year-from', yearFromValue);
    updateSingleTriggerLabel(modal, 'year-to', yearToValue);

    const yearToTrigger = modal.querySelector('[data-single-trigger="year-to"]');
    if (yearToTrigger) {
      yearToTrigger.disabled = !yearFromValue;
    }
    updateYearToOptions(modal, yearFromValue);

    updateTriggerLabel(modal, 'tech', filters.techs);
    updateTriggerLabel(modal, 'refs', filters.refs);

    updateSingleTriggerLabel(modal, 'tech-boolean', filters.techMatch || 'or');
    updateSingleTriggerLabel(modal, 'refs-boolean', filters.refMatch || 'or');
  }

  function getFocusableElements(modal) {
    const dialog = modal.querySelector('.advanced-search-dialog');
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(element => !element.hasAttribute('disabled'))
      .filter(element => !element.closest('[hidden]'));
  }

  function getPanelFocusables(panel) {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(element => !element.hasAttribute('disabled'))
      .filter(element => !element.closest('[hidden]'));
  }

  function trapPanelFocus(panel, event) {
    if (!panel || panel.hidden) return false;
    if (event.key !== 'Tab') return false;
    const focusables = getPanelFocusables(panel);

    if (!focusables.length) {
      event.preventDefault();
      panel.focus();
      return true;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (active === panel) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return true;
    }

    if (!panel.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return true;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
      return true;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return true;
    }

    return false;
  }

  function trapFocus(modal, event) {
    if (!modal.classList.contains(OPEN_CLASS)) return;
    if (event.key !== 'Tab') return;

    const dialog = modal.querySelector('.advanced-search-dialog');
    const focusables = getFocusableElements(modal);
    if (!dialog) return;

    if (!focusables.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (active === dialog) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (!modal.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    }
  }

  function openModal(modal) {
    if (!modal) return;
    closeAllPanels(modal);
    modal.classList.add(OPEN_CLASS);
    modal.setAttribute('aria-hidden', 'false');
    const dialog = modal.querySelector('.advanced-search-dialog');
    if (dialog) dialog.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    closeAllPanels(modal);
    modal.classList.remove(OPEN_CLASS);
    modal.setAttribute('aria-hidden', 'true');
  }

  function initModal(modal) {
    const collection = getCollection(modal);
    if (!collection || !window.CollectionTable) return;

    const openButton = document.querySelector(`.advanced-search-open[data-collection="${collection}"]`);
    if (openButton && !openButton.dataset.advancedInit) {
      openButton.dataset.advancedInit = '1';
      openButton.addEventListener('click', () => {
        const state = CollectionTable.getState(collection);
        syncModalInputs(modal, state);
        document.querySelectorAll(`${MODAL_SELECTOR}.${OPEN_CLASS}`).forEach(other => {
          if (other !== modal) closeModal(other);
        });
        openModal(modal);
      });
    }

    modal.querySelectorAll('[data-advanced-close]').forEach(closeEl => {
      if (closeEl.dataset.closeInit === '1') return;
      closeEl.dataset.closeInit = '1';
      closeEl.addEventListener('click', () => closeModal(modal));
    });

    const acceptButton = modal.querySelector('.advanced-accept');
    if (acceptButton && acceptButton.dataset.acceptInit !== '1') {
      acceptButton.dataset.acceptInit = '1';
      acceptButton.addEventListener('click', () => closeModal(modal));
    }

    const clearButton = modal.querySelector('.advanced-clear');
    if (clearButton && clearButton.dataset.clearInit !== '1') {
      clearButton.dataset.clearInit = '1';
      clearButton.addEventListener('click', () => {
        CollectionTable.clearAllFilters(collection, { resetSort: true, focusInput: false });
      });
    }

    let searchTimeout;
    const searchInput = modal.querySelector('.advanced-search-input');
    if (searchInput && searchInput.dataset.searchInit !== '1') {
      searchInput.dataset.searchInit = '1';
      searchInput.addEventListener('input', (event) => {
        clearTimeout(searchTimeout);
        const value = event.target.value;
        searchTimeout = setTimeout(() => {
          CollectionTable.updateFilters(collection, { query: value });
        }, INPUT_DEBOUNCE_MS);
      });
    }

    modal.querySelectorAll('[data-multi-panel], [data-single-panel]').forEach(panel => {
      if (panel.dataset.panelInit === '1') return;
      panel.dataset.panelInit = '1';
      panel.addEventListener('wheel', (event) => {
        event.stopPropagation();
      });
    });

    modal.querySelectorAll('[data-multi-trigger]').forEach(trigger => {
      if (trigger.dataset.triggerInit === '1') return;
      trigger.dataset.triggerInit = '1';
      trigger.addEventListener('click', () => {
        const type = trigger.getAttribute('data-multi-trigger');
        const panel = modal.querySelector(`[data-multi-panel="${type}"]`);
        const isOpen = panel && !panel.hidden;
        closeAllPanels(modal);
        setPanelOpen(modal, type, !isOpen);
      });
    });

    modal.querySelectorAll('[data-single-trigger]').forEach(trigger => {
      if (trigger.dataset.singleTriggerInit === '1') return;
      trigger.dataset.singleTriggerInit = '1';
      trigger.addEventListener('click', () => {
        if (trigger.disabled) return;
        const type = trigger.getAttribute('data-single-trigger');
        const panel = modal.querySelector(`[data-single-panel="${type}"]`);
        const isOpen = panel && !panel.hidden;
        closeAllPanels(modal);
        setSinglePanelOpen(modal, type, !isOpen);
      });
    });

    modal.querySelectorAll('[data-multi-ok]').forEach(okButton => {
      if (okButton.dataset.okInit === '1') return;
      okButton.dataset.okInit = '1';
      okButton.addEventListener('click', () => {
        const type = okButton.getAttribute('data-multi-ok');
        setPanelOpen(modal, type, false);
      });
    });

    modal.querySelectorAll('[data-multi-option="tech"]').forEach(option => {
      if (option.dataset.optionInit === '1') return;
      option.dataset.optionInit = '1';
      option.addEventListener('change', () => {
        const values = getSelectedValues(modal, 'tech');
        CollectionTable.updateFilters(collection, { techs: values });
      });
    });

    modal.querySelectorAll('[data-multi-option="refs"]').forEach(option => {
      if (option.dataset.optionInit === '1') return;
      option.dataset.optionInit = '1';
      option.addEventListener('change', () => {
        const values = getSelectedValues(modal, 'refs');
        CollectionTable.updateFilters(collection, { refs: values });
      });
    });

    modal.querySelectorAll('[data-single-option]').forEach(option => {
      if (option.dataset.singleOptionInit === '1') return;
      option.dataset.singleOptionInit = '1';
      option.addEventListener('click', () => {
        if (option.disabled) return;
        const type = option.getAttribute('data-single-option');
        const value = option.getAttribute('data-value') || '';

        if (type === 'stars') {
          CollectionTable.updateFilters(collection, { stars: value });
          setSinglePanelOpen(modal, type, false);
          return;
        }

        if (type === 'year-from') {
          const state = CollectionTable.getState(collection);
          const currentTo = state.filters.yearTo !== null ? String(state.filters.yearTo) : '';
          const updates = { yearFrom: value };
          if (!value || (currentTo && currentTo === value)) {
            updates.yearTo = '';
          }
          CollectionTable.updateFilters(collection, updates);
          setSinglePanelOpen(modal, type, false);
          return;
        }

        if (type === 'year-to') {
          const state = CollectionTable.getState(collection);
          const fromValue = state.filters.yearFrom !== null ? String(state.filters.yearFrom) : '';
          if (!fromValue) {
            return;
          }
          if (value && value === fromValue) {
            return;
          }
          CollectionTable.updateFilters(collection, { yearTo: value });
          setSinglePanelOpen(modal, type, false);
        }

        if (type === 'tech-boolean') {
          CollectionTable.updateFilters(collection, { techMatch: value || 'or' });
          setSinglePanelOpen(modal, type, false);
        }

        if (type === 'refs-boolean') {
          CollectionTable.updateFilters(collection, { refMatch: value || 'or' });
          setSinglePanelOpen(modal, type, false);
        }
      });
    });

    CollectionTable.registerAdvancedSync(collection, (state) => {
      syncModalInputs(modal, state);
    });
  }

  function initAll() {
    document.querySelectorAll(MODAL_SELECTOR).forEach(modal => {
      initModal(modal);
    });

    document.addEventListener('click', (event) => {
      document.querySelectorAll(`${MODAL_SELECTOR}.${OPEN_CLASS}`).forEach(modal => {
        if (!modal.contains(event.target)) return;
        if (!event.target.closest('.multi-select, .single-select')) {
          closeAllPanels(modal);
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const openPanels = document.querySelectorAll(
        `${MODAL_SELECTOR}.${OPEN_CLASS} [data-multi-panel]:not([hidden]), ${MODAL_SELECTOR}.${OPEN_CLASS} [data-single-panel]:not([hidden])`
      );
      if (openPanels.length) {
        openPanels.forEach(panel => {
          const parentModal = panel.closest(MODAL_SELECTOR);
          if (parentModal) closeAllPanels(parentModal);
        });
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      document.querySelectorAll(`${MODAL_SELECTOR}.${OPEN_CLASS}`).forEach(modal => {
        closeModal(modal);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const openPanel = document.querySelector(
        `${MODAL_SELECTOR}.${OPEN_CLASS} [data-multi-panel]:not([hidden]), ${MODAL_SELECTOR}.${OPEN_CLASS} [data-single-panel]:not([hidden])`
      );
      if (openPanel) {
        trapPanelFocus(openPanel, event);
        return;
      }
      const openModals = document.querySelectorAll(`${MODAL_SELECTOR}.${OPEN_CLASS}`);
      openModals.forEach(modal => {
        trapFocus(modal, event);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll, { once: true });
  } else {
    initAll();
  }
})();
