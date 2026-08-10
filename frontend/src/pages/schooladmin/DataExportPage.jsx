import { useState } from 'react';
import { downloadExport } from '../../features/export/api';

const EXPORTS = [
  { type: 'students', filename: 'students.csv', label: 'Students', description: 'Full roster with class, gender, date of birth and status.' },
  { type: 'teachers', filename: 'teachers.csv', label: 'Teachers', description: 'Staff list with contact details and employee number.' },
  { type: 'fees', filename: 'fee-invoices.csv', label: 'Fee Invoices', description: 'Every invoice — amount due, amount paid, and status.' },
  { type: 'attendance', filename: 'attendance.csv', label: 'Attendance', description: 'Full attendance history across every class.' },
  { type: 'results', filename: 'results.csv', label: 'Results', description: 'Exam scores by student and subject.' },
];

// Parses the JSON error message out of a failed blob response — axios
// still returns a Blob for error bodies when responseType is 'blob'.
async function extractErrorMessage(err) {
  try {
    const text = await err.response.data.text();
    return JSON.parse(text).message;
  } catch {
    return null;
  }
}

export default function DataExportPage() {
  const [downloadingType, setDownloadingType] = useState(null);
  const [error, setError] = useState('');

  async function handleDownload(item) {
    setError('');
    setDownloadingType(item.type);
    try {
      await downloadExport(item.type, item.filename);
    } catch (err) {
      setError((await extractErrorMessage(err)) || 'Failed to download export');
    } finally {
      setDownloadingType(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Export Data</h1>
      <p className="text-sm text-slate-500 mb-6">
        Download your school's data as CSV files, openable in Excel or Google Sheets — your records, always
        yours.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {EXPORTS.map((item) => (
          <div
            key={item.type}
            className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl shadow-sm p-4"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
            </div>
            <button
              onClick={() => handleDownload(item)}
              disabled={downloadingType === item.type}
              className="shrink-0 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {downloadingType === item.type ? 'Downloading…' : 'Download CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
