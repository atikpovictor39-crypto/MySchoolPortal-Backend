import { useEffect, useState } from 'react';
import { useParent } from '../../context/ParentContext';
import ChildTabs from '../../components/parent/ChildTabs';
import { getChildExams, getChildReportCard, getSchoolInfo } from '../../features/parent/api';

// 1st, 2nd, 3rd, 4th, 11th–13th stay "th" (not "11st"/"12nd"/"13rd").
function ordinalSuffix(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export default function ParentResultsPage() {
  const { childList, selectedChildId, isLoading: isLoadingChildren, error: childrenError } = useParent();

  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportCard, setReportCard] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);

  useEffect(() => {
    getSchoolInfo()
      .then(setSchoolProfile)
      .catch(() => {});
  }, []);

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
                    <button onClick={() => openReportCard(exam.id)} className="text-blue-600 text-xs font-medium">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 print:static print:bg-transparent print:p-0 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 print:shadow-none print:max-w-none print:rounded-none">
            <div className="flex justify-between items-start mb-4 print:hidden">
              <h2 className="text-base font-semibold text-slate-900">Report Card</h2>
              <button onClick={() => setReportCard(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                Close
              </button>
            </div>

            {/* Letterhead */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-3">
                {schoolProfile?.logo_url && (
                  <img src={schoolProfile.logo_url} alt="" className="w-14 h-14 object-contain shrink-0" />
                )}
                <div>
                  <p className="text-lg font-bold text-slate-900 leading-tight">{schoolProfile?.name || 'School'}</p>
                  {schoolProfile?.address && <p className="text-xs text-slate-600">{schoolProfile.address}</p>}
                  <p className="text-xs text-slate-600">
                    {[schoolProfile?.phone, schoolProfile?.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-center text-sm font-bold uppercase tracking-wide mb-4">Result Slip</p>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-4">
              <p>
                <span className="font-semibold">Name of Student: </span>
                {reportCard.student.first_name} {reportCard.student.last_name}
              </p>
              <p>
                <span className="font-semibold">Year: </span>
                {reportCard.exam.academic_year_name || '—'}
              </p>
              <p>
                <span className="font-semibold">Class: </span>
                {reportCard.exam.class_name}
                {reportCard.exam.class_section ? ` ${reportCard.exam.class_section}` : ''}
              </p>
              <p>
                <span className="font-semibold">No. on Roll: </span>
                {reportCard.noOnRoll}
              </p>
              <p>
                <span className="font-semibold">No. of Times Present: </span>
                {reportCard.attendance.present ?? 'N/A'}
              </p>
              <p>
                <span className="font-semibold">No. of Times Absent: </span>
                {reportCard.attendance.total !== null
                  ? reportCard.attendance.total - reportCard.attendance.present
                  : 'N/A'}
              </p>
              <p>
                <span className="font-semibold">Vacation Date: </span>
                {reportCard.exam.term_end_date ? reportCard.exam.term_end_date.slice(0, 10) : '—'}
              </p>
              <p>
                <span className="font-semibold">Re-opening Date: </span>
                {reportCard.exam.reopening_date ? reportCard.exam.reopening_date.slice(0, 10) : '—'}
              </p>
              <p>
                <span className="font-semibold">Term: </span>
                {reportCard.exam.term || '—'}
              </p>
              <p>
                <span className="font-semibold">Promoted To: </span>
                {reportCard.notes.promoted_to || '—'}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm mb-3 border border-slate-300 print:border-slate-800">
                <thead className="text-left bg-slate-50 print:bg-transparent">
                  <tr>
                    <th className="py-1.5 px-2 border-b border-slate-300 print:border-slate-800">Subjects</th>
                    <th className="py-1.5 px-2 border-b border-slate-300 print:border-slate-800">Marks</th>
                    <th className="py-1.5 px-2 border-b border-slate-300 print:border-slate-800">Position</th>
                    <th className="py-1.5 px-2 border-b border-slate-300 print:border-slate-800">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {reportCard.subjects.map((s) => (
                    <tr key={s.exam_subject_id} className="border-b border-slate-200">
                      <td className="py-1 px-2 uppercase">{s.subject_name}</td>
                      <td className="py-1 px-2">{s.marks_obtained !== null ? s.marks_obtained : '—'}</td>
                      <td className="py-1 px-2">{s.position ? `${s.position}${ordinalSuffix(s.position)}` : '—'}</td>
                      <td className="py-1 px-2">{s.remarks || ''}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1 px-2">Total</td>
                    <td className="py-1 px-2">{reportCard.totalObtained}</td>
                    <td className="py-1 px-2">
                      {reportCard.position ? `${reportCard.position}${ordinalSuffix(reportCard.position)}` : '—'}
                    </td>
                    <td className="py-1 px-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-sm space-y-1 mb-3">
              <p>
                <span className="font-semibold">Interest: </span>
                {reportCard.notes.interest || '—'}
              </p>
              <p>
                <span className="font-semibold">Academic Strength: </span>
                {reportCard.notes.academic_strength || '—'}
              </p>
              <p>
                <span className="font-semibold">Attendance: </span>
                {reportCard.attendance.total !== null
                  ? `${reportCard.attendance.present} out of ${reportCard.attendance.total}`
                  : 'Not available yet'}
              </p>
            </div>

            <div className="text-sm mb-3">
              <p className="font-semibold mb-1">Class Teacher's Remarks:</p>
              <p className="whitespace-pre-wrap">{reportCard.notes.class_teacher_remarks || '—'}</p>
              <div className="flex justify-between items-end mt-2 text-xs">
                <p>Teacher's Name: {reportCard.classTeacherName || '_______________________'}</p>
                <p>Signature: _______________________</p>
              </div>
            </div>

            <div className="text-sm mb-2">
              <p className="font-semibold mb-1">Headmaster's Remarks:</p>
              <p className="whitespace-pre-wrap">{reportCard.notes.headmaster_remarks || '—'}</p>
              <div className="flex justify-between items-end mt-2 text-xs">
                <p>Headmaster's Signature: {schoolProfile?.headmaster_signature || '_______________________'}</p>
                <p>Date: {reportCard.exam.headmaster_signed_date?.slice(0, 10) || '_______________________'}</p>
              </div>
            </div>

            <button onClick={() => window.print()} className="print:hidden mt-2 text-sm text-blue-600 underline">
              Print report card
            </button>
          </div>
        </div>
      )}
    </>
  );
}
