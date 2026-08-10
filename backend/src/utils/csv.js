// Minimal CSV serializer — no need for a dependency for something this
// small. Quotes any value containing a comma, quote, or newline, doubling
// internal quotes per the standard CSV escaping rule.
function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// columns: [{ label: 'Column Header', value: (row) => row.field }]
function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsvValue(c.value(row))).join(','));
  return [header, ...lines].join('\r\n');
}

module.exports = { toCsv };
