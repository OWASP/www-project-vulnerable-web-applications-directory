(() => {
  const AdvancedSearchUI = window.AdvancedSearchUI || (window.AdvancedSearchUI = {});
  AdvancedSearchUI._modules = AdvancedSearchUI._modules || {};
  if (AdvancedSearchUI._modules.modal) return;
  AdvancedSearchUI._modules.modal = true;

  const { OPEN_CLASS } = AdvancedSearchUI.constants;

  function openModal(modal) {
    if (!modal) return;
    AdvancedSearchUI.dropdowns.closeAllPanels(modal);
    modal.classList.add(OPEN_CLASS);
    modal.setAttribute('aria-hidden', 'false');
    const dialog = modal.querySelector('.advanced-search-dialog');
    if (dialog) dialog.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    AdvancedSearchUI.dropdowns.closeAllPanels(modal);
    modal.classList.remove(OPEN_CLASS);
    modal.setAttribute('aria-hidden', 'true');
  }

  AdvancedSearchUI.modal = {
    openModal,
    closeModal
  };
})();
