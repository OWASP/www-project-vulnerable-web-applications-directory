(() => {
  const CollectionTable = window.CollectionTable || (window.CollectionTable = {});
  CollectionTable._modules = CollectionTable._modules || {};
  if (CollectionTable._modules.utils) return;
  CollectionTable._modules.utils = true;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeList(values) {
    if (!Array.isArray(values)) return [];
    return values.map(value => String(value).trim()).filter(Boolean);
  }

  function normalizeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getTableRows(wrapper) {
    const table = wrapper.querySelector('table');
    if (!table) return [];
    const rows = Array.from(table.querySelectorAll('tr'));
    return rows.slice(1);
  }

  function getLowerText(element) {
    if (!element) return '';
    return element.textContent.trim().toLowerCase();
  }

  function parseFilterList(value) {
    if (!value) return [];
    return value.split('|').map(item => item.trim().toLowerCase()).filter(Boolean);
  }

  function hasActiveFilters(filters) {
    return Boolean(
      filters.query ||
      filters.techs.length ||
      filters.refs.length ||
      filters.stars !== null ||
      filters.yearFrom !== null ||
      filters.yearTo !== null
    );
  }

  function formatStars(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number.toLocaleString('en-US');
  }

  CollectionTable.utils = {
    escapeHtml,
    normalizeList,
    normalizeNumber,
    getTableRows,
    getLowerText,
    parseFilterList,
    hasActiveFilters,
    formatStars
  };
})();
