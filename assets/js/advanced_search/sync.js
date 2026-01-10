(() => {
  const AdvancedSearchUI = window.AdvancedSearchUI || (window.AdvancedSearchUI = {});
  AdvancedSearchUI._modules = AdvancedSearchUI._modules || {};
  if (AdvancedSearchUI._modules.sync) return;
  AdvancedSearchUI._modules.sync = true;

  const {
    updateSingleTriggerLabel,
    updateYearToOptions,
    updateTriggerLabel
  } = AdvancedSearchUI.dropdowns;

  function updateSingleOptionStates(modal, type, value) {
    const stringValue = value === null || value === undefined ? '' : String(value);
    modal.querySelectorAll(`[data-single-option="${type}"]`).forEach(option => {
      const optionValue = option.getAttribute('data-value') || '';
      option.setAttribute('aria-selected', optionValue === stringValue ? 'true' : 'false');
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
    updateSingleOptionStates(modal, 'stars', starsValue);

    const yearFromValue = filters.yearFrom !== null ? String(filters.yearFrom) : '';
    const yearToValue = filters.yearTo !== null ? String(filters.yearTo) : '';
    updateSingleTriggerLabel(modal, 'year-from', yearFromValue);
    updateSingleTriggerLabel(modal, 'year-to', yearToValue);
    updateSingleOptionStates(modal, 'year-from', yearFromValue);
    updateSingleOptionStates(modal, 'year-to', yearToValue);

    const yearToTrigger = modal.querySelector('[data-single-trigger="year-to"]');
    if (yearToTrigger) {
      yearToTrigger.disabled = !yearFromValue;
    }
    updateYearToOptions(modal, yearFromValue);

    updateTriggerLabel(modal, 'tech', filters.techs);
    updateTriggerLabel(modal, 'refs', filters.refs);

    updateSingleTriggerLabel(modal, 'tech-boolean', filters.techMatch || 'or');
    updateSingleTriggerLabel(modal, 'refs-boolean', filters.refMatch || 'or');
    updateSingleOptionStates(modal, 'tech-boolean', filters.techMatch || 'or');
    updateSingleOptionStates(modal, 'refs-boolean', filters.refMatch || 'or');
  }

  AdvancedSearchUI.sync = {
    syncModalInputs
  };
})();
