(() => {
  const AdvancedSearchUI = window.AdvancedSearchUI || (window.AdvancedSearchUI = {});
  if (AdvancedSearchUI.__initialized) return;
  AdvancedSearchUI.__initialized = true;

  const { MODAL_SELECTOR, OPEN_CLASS, INPUT_DEBOUNCE_MS } = AdvancedSearchUI.constants;
  const { getCollection, trapPanelFocus, trapFocus } = AdvancedSearchUI.utils;
  const { closeAllPanels, setPanelOpen, setSinglePanelOpen, getSelectedValues } = AdvancedSearchUI.dropdowns;
  const { openModal, closeModal } = AdvancedSearchUI.modal;
  const { syncModalInputs } = AdvancedSearchUI.sync;

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
