(() => {
  const AdvancedSearchUI = window.AdvancedSearchUI || (window.AdvancedSearchUI = {});
  AdvancedSearchUI._modules = AdvancedSearchUI._modules || {};
  if (AdvancedSearchUI._modules.index) return;
  AdvancedSearchUI._modules.index = true;

  const { MODAL_SELECTOR, INPUT_DEBOUNCE_MS } = AdvancedSearchUI.constants;
  const { getCollection, trapFocus, trapPanelFocus } = AdvancedSearchUI.utils;
  const {
    closeAllPanels,
    setPanelOpen,
    setSinglePanelOpen,
    getSelectedValues,
    updateTriggerLabel
  } = AdvancedSearchUI.dropdowns;
  const { syncModalInputs, renderModalPills } = AdvancedSearchUI.sync;

  const drafts = new Map();
  const inputTimers = new Map();

  function cloneFilters(source) {
    const base = CollectionTable.getDefaultFilters();
    if (!source) return base;
    return {
      query: source.query ? String(source.query) : '',
      techs: Array.isArray(source.techs) ? [...source.techs] : [],
      refs: Array.isArray(source.refs) ? [...source.refs] : [],
      stars: source.stars === null || source.stars === undefined ? null : source.stars,
      yearFrom: source.yearFrom === null || source.yearFrom === undefined ? null : source.yearFrom,
      yearTo: source.yearTo === null || source.yearTo === undefined ? null : source.yearTo,
      techMatch: source.techMatch === 'and' ? 'and' : 'or',
      refMatch: source.refMatch === 'and' ? 'and' : 'or'
    };
  }

  function getDraft(collection) {
    return drafts.get(collection) || null;
  }

  function setDraft(collection, draft) {
    drafts.set(collection, draft);
  }

  function discardDraft(collection) {
    drafts.delete(collection);
  }

  function updateDraft(collection, updates) {
    const state = CollectionTable.getState(collection);
    const normalizeList = CollectionTable.utils.normalizeList;
    const normalizeNumber = CollectionTable.utils.normalizeNumber;
    const draft = getDraft(collection) || cloneFilters(state.filters);

    if ('query' in updates) {
      const rawQuery = updates.query;
      draft.query = rawQuery === null || rawQuery === undefined ? '' : String(rawQuery).trim();
    }

    if ('techs' in updates) {
      draft.techs = normalizeList(updates.techs);
    }

    if ('refs' in updates) {
      draft.refs = normalizeList(updates.refs);
    }

    if ('stars' in updates) {
      draft.stars = updates.stars === 'none' ? 'none' : normalizeNumber(updates.stars);
    }

    if ('yearFrom' in updates) {
      draft.yearFrom = normalizeNumber(updates.yearFrom);
      if (draft.yearFrom === null) {
        draft.yearTo = null;
      } else if (!('yearTo' in updates)) {
        draft.yearTo = draft.yearFrom;
      }
    }

    if ('yearTo' in updates) {
      draft.yearTo = normalizeNumber(updates.yearTo);
    }

    if ('techMatch' in updates) {
      draft.techMatch = updates.techMatch === 'and' ? 'and' : 'or';
    }

    if ('refMatch' in updates) {
      draft.refMatch = updates.refMatch === 'and' ? 'and' : 'or';
    }

    if (draft.yearFrom === null) {
      draft.yearTo = null;
    }

    setDraft(collection, draft);
    return draft;
  }

  function applyDraftToModal(modal, draft) {
    if (!modal || !draft) return;
    syncModalInputs(modal, draft);
    renderModalPills(modal, draft);
  }

  function resetDraft(collection, modal) {
    const draft = CollectionTable.getDefaultFilters();
    setDraft(collection, draft);
    applyDraftToModal(modal, draft);
  }

  function commitDraft(collection) {
    const draft = getDraft(collection);
    if (!draft) return;
    CollectionTable.updateFilters(collection, draft);
    discardDraft(collection);
  }

  function isModalOpen(modal) {
    return modal.classList.contains(AdvancedSearchUI.constants.OPEN_CLASS);
  }

  function closeModalAndDiscard(modal, options = {}) {
    const collection = getCollection(modal);
    discardDraft(collection);
    AdvancedSearchUI.modal.closeModal(modal, options);
  }

  function closeOtherModals(activeModal) {
    document.querySelectorAll(MODAL_SELECTOR).forEach(modal => {
      if (modal === activeModal) return;
      if (modal.classList.contains(AdvancedSearchUI.constants.OPEN_CLASS)) {
        closeModalAndDiscard(modal, { restoreFocus: false });
      }
    });
  }

  function applyTriggerDraft(modal, collection, type) {
    const values = getSelectedValues(modal, type);
    updateTriggerLabel(modal, type, values);
    const draft = updateDraft(collection, type === 'tech' ? { techs: values } : { refs: values });
    applyDraftToModal(modal, draft);
  }

  function getPanelFocusables(panel, kind) {
    if (!panel) return [];
    if (kind === 'multi') {
      return Array.from(panel.querySelectorAll('.multi-select-ok, input[type="checkbox"]'))
        .filter(element => !element.hasAttribute('disabled') && !element.closest('[hidden]'));
    }
    return Array.from(panel.querySelectorAll('.single-option'))
      .filter(element => !element.hasAttribute('disabled') && !element.hasAttribute('hidden'));
  }

  function focusPanelItem(items, index) {
    if (!items.length) return;
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    items[clamped].focus();
  }

  function handlePanelKeydown(event, panel, kind, modal) {
    if (trapPanelFocus(panel, event)) return;

    const items = getPanelFocusables(panel, kind);
    if (!items.length) return;

    const activeIndex = items.indexOf(document.activeElement);
    const lastIndex = items.length - 1;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusPanelItem(items, activeIndex < 0 ? 0 : Math.min(lastIndex, activeIndex + 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusPanelItem(items, activeIndex < 0 ? lastIndex : Math.max(0, activeIndex - 1));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusPanelItem(items, 0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusPanelItem(items, lastIndex);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeAllPanels(modal);
      const trigger = modal.querySelector(`[aria-controls="${panel.id}"]`);
      if (trigger) trigger.focus();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      const active = document.activeElement;
      if (!active || !panel.contains(active)) return;
      event.preventDefault();
      if (active.tagName === 'INPUT' && active.type === 'checkbox') {
        active.checked = !active.checked;
        active.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (active.tagName === 'BUTTON') {
        active.click();
      }
    }
  }

  function handleModalKeydown(event, modal) {
    trapFocus(modal, event);
    if (event.key !== 'Escape') return;
    const openPanel = modal.querySelector('[data-multi-panel][data-open], [data-single-panel][data-open]');
    if (openPanel) {
      closeAllPanels(modal);
      return;
    }
    closeModalAndDiscard(modal);
  }

  function dedupeMultiOptions(modal) {
    if (!modal) return;
    const seen = new Set();
    modal.querySelectorAll('[data-multi-option]').forEach(input => {
      const type = input.getAttribute('data-multi-option') || '';
      const value = (input.value || '').trim().toLowerCase();
      const key = `${type}:${value}`;
      if (!value) return;
      if (seen.has(key)) {
        const option = input.closest('.multi-option');
        if (option) option.remove();
        return;
      }
      seen.add(key);
    });
  }

  function initModal(modal) {
    if (modal.dataset.advancedInit === '1') return;
    modal.dataset.advancedInit = '1';

    const collection = getCollection(modal);
    const searchInput = modal.querySelector('.advanced-search-input');
    const clearButton = modal.querySelector('.advanced-clear');
    const acceptButton = modal.querySelector('.advanced-accept');

    dedupeMultiOptions(modal);

    CollectionTable.registerAdvancedSync(collection, (state) => {
      const draft = getDraft(collection);
      if (draft && isModalOpen(modal)) return;
      syncModalInputs(modal, state);
      renderModalPills(modal, state);
    });

    modal.addEventListener('keydown', (event) => handleModalKeydown(event, modal));

    modal.addEventListener('click', (event) => {
      const closeTarget = event.target.closest('[data-advanced-close]');
      if (closeTarget) {
        closeModalAndDiscard(modal);
        return;
      }

      const trigger = event.target.closest('[data-multi-trigger], [data-single-trigger]');
      const panel = event.target.closest('[data-multi-panel], [data-single-panel]');
      if (!trigger && !panel) {
        closeAllPanels(modal);
      }
    });

    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        const value = event.target.value;
        const prevTimer = inputTimers.get(collection);
        if (prevTimer) clearTimeout(prevTimer);
        inputTimers.set(collection, setTimeout(() => {
          const draft = updateDraft(collection, { query: value });
          applyDraftToModal(modal, draft);
        }, INPUT_DEBOUNCE_MS));
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        resetDraft(collection, modal);
      });
    }

    if (acceptButton) {
      acceptButton.addEventListener('click', () => {
        commitDraft(collection);
        AdvancedSearchUI.modal.closeModal(modal);
      });
    }

    modal.querySelectorAll('[data-multi-trigger]').forEach(trigger => {
      const type = trigger.getAttribute('data-multi-trigger');
      trigger.addEventListener('click', () => {
        const panel = modal.querySelector(`[data-multi-panel="${type}"]`);
        if (!panel) return;
        const isOpen = panel.dataset.open === '1';
        closeAllPanels(modal);
        if (!isOpen) {
          setPanelOpen(modal, type, true);
        }
      });
    });

    modal.querySelectorAll('[data-multi-ok]').forEach(button => {
      const type = button.getAttribute('data-multi-ok');
      button.addEventListener('click', () => {
        setPanelOpen(modal, type, false);
        const trigger = modal.querySelector(`[data-multi-trigger="${type}"]`);
        if (trigger) trigger.focus();
      });
    });

    modal.querySelectorAll('[data-single-trigger]').forEach(trigger => {
      const type = trigger.getAttribute('data-single-trigger');
      trigger.addEventListener('click', () => {
        const panel = modal.querySelector(`[data-single-panel="${type}"]`);
        if (!panel) return;
        const isOpen = panel.dataset.open === '1';
        closeAllPanels(modal);
        if (!isOpen) {
          setSinglePanelOpen(modal, type, true);
        }
      });
    });

    modal.querySelectorAll('[data-multi-panel]').forEach(panel => {
      const type = panel.getAttribute('data-multi-panel');
      panel.addEventListener('keydown', (event) => handlePanelKeydown(event, panel, 'multi', modal));
      panel.addEventListener('change', (event) => {
        if (event.target.matches(`[data-multi-option="${type}"]`)) {
          applyTriggerDraft(modal, collection, type);
        }
      });
    });

    modal.querySelectorAll('[data-single-panel]').forEach(panel => {
      const type = panel.getAttribute('data-single-panel');
      panel.addEventListener('keydown', (event) => handlePanelKeydown(event, panel, 'single', modal));
      panel.addEventListener('click', (event) => {
        const option = event.target.closest(`[data-single-option="${type}"]`);
        if (!option || option.hasAttribute('disabled') || option.hasAttribute('hidden')) return;
        const value = option.getAttribute('data-value') || '';
        const update = {};
        if (type === 'stars') {
          update.stars = value;
        } else if (type === 'year-from') {
          update.yearFrom = value;
        } else if (type === 'year-to') {
          update.yearTo = value;
        } else if (type === 'tech-boolean') {
          update.techMatch = value;
        } else if (type === 'refs-boolean') {
          update.refMatch = value;
        }
        const draft = updateDraft(collection, update);
        applyDraftToModal(modal, draft);
        setSinglePanelOpen(modal, type, false);
        const trigger = modal.querySelector(`[data-single-trigger="${type}"]`);
        if (trigger) trigger.focus();
      });
    });

    const modalPills = modal.querySelector('.filter-pills[data-pill-scope="modal"]');
    if (modalPills) {
      modalPills.addEventListener('click', (event) => {
        const pill = event.target.closest('.filter-pill');
        if (!pill) return;
        const type = pill.getAttribute('data-pill-type');
        const value = pill.getAttribute('data-pill-value');
        const update = {};

        if (type === 'query') {
          update.query = '';
        } else if (type === 'tech') {
          const draft = getDraft(collection) || cloneFilters(CollectionTable.getState(collection).filters);
          update.techs = draft.techs.filter(item => item !== value);
        } else if (type === 'refs') {
          const draft = getDraft(collection) || cloneFilters(CollectionTable.getState(collection).filters);
          update.refs = draft.refs.filter(item => item !== value);
        } else if (type === 'stars') {
          update.stars = null;
        } else if (type === 'year') {
          update.yearFrom = null;
          update.yearTo = null;
        }

        const draft = updateDraft(collection, update);
        applyDraftToModal(modal, draft);
      });
    }

  }

  function initOpenButtons() {
    document.querySelectorAll('.advanced-search-open').forEach(button => {
      if (button.dataset.advancedInit === '1') return;
      button.dataset.advancedInit = '1';

      button.addEventListener('click', () => {
        const collection = button.getAttribute('data-collection');
        const modal = document.querySelector(`#advanced-search-modal-${collection}`);
        if (!modal) return;
        closeOtherModals(modal);
        const state = CollectionTable.getState(collection);
        const draft = cloneFilters(state.filters);
        setDraft(collection, draft);
        applyDraftToModal(modal, draft);
        modal._returnFocusEl = button;
        AdvancedSearchUI.modal.openModal(modal);
      });
    });
  }

  function initAll() {
    document.querySelectorAll(MODAL_SELECTOR).forEach(modal => initModal(modal));
    initOpenButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll, { once: true });
  } else {
    initAll();
  }
})();
