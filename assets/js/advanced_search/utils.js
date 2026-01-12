(() => {
  const AdvancedSearchUI = window.AdvancedSearchUI || (window.AdvancedSearchUI = {});
  AdvancedSearchUI._modules = AdvancedSearchUI._modules || {};
  if (AdvancedSearchUI._modules.utils) return;
  AdvancedSearchUI._modules.utils = true;

  const constants = {
    MODAL_SELECTOR: '.advanced-search-modal',
    OPEN_CLASS: 'is-open',
    INPUT_DEBOUNCE_MS: 300,
    FOCUSABLE_SELECTOR: 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    PANEL_MIN_WIDTH: 80,
    PANEL_MAX_WIDTH: 240,
    PANEL_PADDING: 24
  };

  function getCollection(element) {
    return element ? element.getAttribute('data-collection') : '';
  }

  function getFocusableElements(modal) {
    const dialog = modal.querySelector('.advanced-search-dialog');
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll(constants.FOCUSABLE_SELECTOR))
      .filter(element => !element.hasAttribute('disabled'))
      .filter(element => !element.closest('[hidden]'));
  }

  function getPanelFocusables(panel) {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll(constants.FOCUSABLE_SELECTOR))
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
    if (!modal.classList.contains(constants.OPEN_CLASS)) return;
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

  AdvancedSearchUI.constants = constants;
  AdvancedSearchUI.utils = {
    getCollection,
    getFocusableElements,
    getPanelFocusables,
    trapPanelFocus,
    trapFocus
  };
})();
