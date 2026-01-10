(() => {
  const CollectionTable = window.CollectionTable || (window.CollectionTable = {});
  CollectionTable._modules = CollectionTable._modules || {};
  if (CollectionTable._modules.state) return;
  CollectionTable._modules.state = true;

  const collectionStates = new Map();

  function getDefaultFilters() {
    return {
      query: '',
      techs: [],
      refs: [],
      stars: null,
      yearFrom: null,
      yearTo: null,
      techMatch: 'or',
      refMatch: 'or'
    };
  }

  function getState(collection) {
    let state = collectionStates.get(collection);
    if (!state) {
      state = {
        collection,
        wrapper: null,
        filterInput: null,
        clearButton: null,
        sortInfo: null,
        pillContainers: [],
        originalRows: [],
        filterTimeout: null,
        visibleCount: 0,
        filters: getDefaultFilters(),
        sort: {
          columnIndex: null,
          direction: null,
          mode: 'text',
          clickCount: 0,
          columnName: null,
          displayLabel: null
        },
        sortHeaders: [],
        advancedSync: null
      };
      collectionStates.set(collection, state);
    }
    return state;
  }

  CollectionTable._collectionStates = collectionStates;
  CollectionTable.getDefaultFilters = getDefaultFilters;
  CollectionTable.getState = getState;
})();
