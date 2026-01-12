(() => {
  const CollectionTable = window.CollectionTable || (window.CollectionTable = {});
  if (CollectionTable.__initialized) return;

  const WRAPPER_SELECTOR = '.collection-table-wrapper';

  function initAll() {
    if (CollectionTable.scroll) {
      CollectionTable.scroll.initInputModalityTracker();
      CollectionTable.scroll.initGlobalHoverKeyHandler();
    }

    document.querySelectorAll(WRAPPER_SELECTOR).forEach(wrapper => {
      if (CollectionTable.scroll) {
        CollectionTable.scroll.initWrapper(wrapper);
      }
      if (CollectionTable.controls) {
        CollectionTable.controls.initFilteringSorting(wrapper);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll, { once: true });
  } else {
    initAll();
  }

  CollectionTable.__initialized = true;
})();
