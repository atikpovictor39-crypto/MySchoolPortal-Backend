import { useEffect, useState } from 'react';
import { useParent } from '../../context/ParentContext';
import ChildTabs from '../../components/parent/ChildTabs';
import { getChildExams, getChildReportCard } from '../../features/parent/api';

export default function ParentResultsPage() {
  const { childList, selectedChildId, isLoading: isLoadingChildren, error: childrenError } = useParent();

  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportCard, setReportCard] = useState(null);

  useEffect(() => {
    if (!selectedChildId) return;
    setIsLoading(true);
    setError('');
    getChildExams(selectedChildId)
      .then(setExams)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load exams'))
      .finally(() => setIsLoading(false));
  }, [selectedChildId]);

  async function openReportCard(examId) {
    setError('');
    try {
      setReportCard(await getChildReportCard(selectedChildId, examId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report card');
    }
  }

  if (isLoadingChildren) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <>
      <div className="max-w-3xl print:hidden">
        <h1 className="text-xl font-semibold text-slate-900 mb-6">Results</h1>

        {(childrenError || error) && (
          <p role="alert" className="text-sm text-red-600 mb-4">
            {childrenError || error}
          </p>
        )}

        {childList.length === 0 ? (
          <p className="text-sm text-slate-500">No children linked to your account yet.</p>
        ) : (
          <>
            <ChildTabs />

            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : exams.length === 0 ? (
              <p className="text-sm text-slate-500">No exams recorded yet.</p>
            ) : (
              <ul className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
                {exams.map((exam) => (
                  <li key={exam.id} className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-slate-900">
                      {exam.name} {exam.term ? <span className="text-slate-400">· {exam.term}</span> : null}
                    </span>
                    <button onClick={() => openReportCard(exam.id)} className="text-indigo-600 text-xs font-medium">
                      View report card
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {reportCard && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 print:static print:bg-transparent print:p-0">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 print:shadow-none print:max-w-none">
            <div className="flex justify-between items-start mb-4 print:hidden">
              <h2 className="text-base font-semibold text-slate-900">Report Card</h2>
              <button onClick={() => setReportCard(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                Close
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-slate-900">
                {reportCard.student.first_name} {reportCard.student.last_name} ({reportCard.student.admission_no})
              </p>
              <p className="text-sm text-slate-600">
                {reportCard.exam.name} {reportCard.exam.term ? `· ${reportCard.exam.term}` : ''}
              </p>
            </div>

            <table className="w-full text-sm mb-4">
              <thead className="text-left text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-1">Subject</th>
                  <th className="py-1">Marks</th>
                  <th className="py-1">Grade</th>
                  <th className="py-1">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {reportCard.subjects.map((s) => (
                  <tr key={s.exam_subject_id} className="border-b border-slate-100">
                    <td className="py-1">{s.subject_name}</td>
                    <td className="py-1">
                      {s.marks_obtained !== null ? `${s.marks_obtained} / ${s.max_marks}` : 'Not entered'}
                    </td>
                    <td className="py-1">{s.grade || '—'}</td>
                    <td className="py-1">{s.remarks || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-200 pt-3">
              <div>
                <p className="text-xs text-slate-500">Total</p>
                <p className="font-medium">
                  {reportCard.totalObtained} / {reportCard.totalMax} ({reportCard.percentage}%)
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Overall grade</p>
                <p className="font-medium">{reportCard.overallGrade || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Position</p>
                <p className="font-medium">
                  {reportCard.position ? `${reportCard.position} of ${reportCard.classSize}` : 'Not ranked yet'}
                </p>
              </div>
            </div>

            <button onClick={() => window.print()} className="print:hidden mt-4 text-sm text-indigo-600 underline">
              Print report card
            </button>
          </div>
        </div>
      )}
    </>
  );
}
