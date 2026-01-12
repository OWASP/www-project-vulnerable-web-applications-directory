(() => {
  const AdvancedSearchUI = window.AdvancedSearchUI || (window.AdvancedSearchUI = {});
  AdvancedSearchUI._modules = AdvancedSearchUI._modules || {};
  if (AdvancedSearchUI._modules.dropdowns) return;
  AdvancedSearchUI._modules.dropdowns = true;

  const { PANEL_MIN_WIDTH, PANEL_MAX_WIDTH, PANEL_PADDING } = AdvancedSearchUI.constants;

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
    const options = Array.from(panel.querySelectorAll('[data-single-option="year-to"]'));
    options.forEach(option => {
      option.hidden = false;
      option.disabled = false;
      option.classList.remove('is-disabled');
      option.style.display = '';
    });
  }

  AdvancedSearchUI.dropdowns = {
    closeAllPanels,
    setPanelOpen,
    setSinglePanelOpen,
    getSelectedValues,
    updateTriggerLabel,
    setPanelWidth,
    updateSingleTriggerLabel,
    updateYearToOptions
  };
})();
