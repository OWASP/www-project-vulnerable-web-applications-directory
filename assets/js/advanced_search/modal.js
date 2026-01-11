(() => {
  const AdvancedSearchUI = window.AdvancedSearchUI || (window.AdvancedSearchUI = {});
  AdvancedSearchUI._modules = AdvancedSearchUI._modules || {};
  if (AdvancedSearchUI._modules.modal) return;
  AdvancedSearchUI._modules.modal = true;

  const { OPEN_CLASS } = AdvancedSearchUI.constants;

  function setHiddenState(element, hidden) {
    if (!element) return;
    if (hidden) {
      if (element.dataset.advancedHidden === '1') return;
      element.dataset.advancedHidden = '1';
      const prev = element.getAttribute('aria-hidden');
      if (prev !== null) {
        element.dataset.advancedPrevAriaHidden = prev;
      }
      element.setAttribute('aria-hidden', 'true');
      if ('inert' in element) {
        element.dataset.advancedPrevInert = element.inert ? '1' : '0';
        element.inert = true;
      }
      return;
    }

    if (element.dataset.advancedHidden !== '1') return;
    if ('advancedPrevAriaHidden' in element.dataset) {
      element.setAttribute('aria-hidden', element.dataset.advancedPrevAriaHidden);
      delete element.dataset.advancedPrevAriaHidden;
    } else {
      element.removeAttribute('aria-hidden');
    }
    if ('inert' in element) {
      const prevInert = element.dataset.advancedPrevInert === '1';
      element.inert = prevInert;
      delete element.dataset.advancedPrevInert;
    }
    delete element.dataset.advancedHidden;
  }

  function getBackgroundTargets(modal) {
    const targets = [];
    let current = modal;

    while (current && current.parentElement && current.parentElement !== document.body) {
      const parent = current.parentElement;
      Array.from(parent.children).forEach(child => {
        if (child !== current) targets.push(child);
      });
      current = parent;
    }

    if (current && current.parentElement === document.body) {
      Array.from(document.body.children).forEach(child => {
        if (child !== current) targets.push(child);
      });
    }

    return targets;
  }

  function setBackgroundHidden(modal, hidden) {
    if (!modal) return;
    if (hidden) {
      const targets = getBackgroundTargets(modal);
      modal._backgroundTargets = targets;
      targets.forEach(target => setHiddenState(target, true));
      return;
    }

    const targets = modal._backgroundTargets || [];
    targets.forEach(target => setHiddenState(target, false));
    modal._backgroundTargets = [];
  }

  function restoreFocus(modal) {
    const stored = modal._returnFocusEl;
    const fallback = modal.getAttribute('data-collection')
      ? document.querySelector(`.advanced-search-open[data-collection="${modal.getAttribute('data-collection')}"]`)
      : null;
    const target = (stored && document.contains(stored)) ? stored : fallback;

    if (target && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    }
    modal._returnFocusEl = null;
  }

  function openModal(modal) {
    if (!modal) return;
    AdvancedSearchUI.dropdowns.closeAllPanels(modal);
    modal.classList.add(OPEN_CLASS);
    modal.setAttribute('aria-hidden', 'false');
    setBackgroundHidden(modal, true);
    const dialog = modal.querySelector('.advanced-search-dialog');
    if (dialog) dialog.focus();
  }

  function closeModal(modal, options = {}) {
    if (!modal) return;
    AdvancedSearchUI.dropdowns.closeAllPanels(modal);
    modal.classList.remove(OPEN_CLASS);
    modal.setAttribute('aria-hidden', 'true');
    setBackgroundHidden(modal, false);
    const shouldRestore = options.restoreFocus !== false;
    if (shouldRestore) {
      restoreFocus(modal);
    } else {
      modal._returnFocusEl = null;
    }
  }

  AdvancedSearchUI.modal = {
    openModal,
    closeModal
  };
})();
