const asyncHandler = require('../../utils/asyncHandler');
const { fail } = require('../../utils/apiResponse');
const { EXPORTERS } = require('./export.service');

exports.download = asyncHandler(async (req, res) => {
  const exporter = EXPORTERS[req.params.type];
  if (!exporter) {
    return fail(res, `Unknown export type. Choose one of: ${Object.keys(EXPORTERS).join(', ')}`, 400);
  }

  const { filename, csv } = await exporter(req.schoolId);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
});
