import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listAcademicYears } from '../../features/academicYears/api';
import { listClasses } from '../../features/classes/api';
import { listSubjects } from '../../features/subjects/api';
import { listStudents } from '../../features/students/api';
import {
  listExams,
  getExam,
  createExam,
  addExamSubjects,
  getResultsSheet,
  saveResults,
  getReportCard,
  getClassReport,
} from '../../features/results/api';

const TABS = [
  { key: 'exams', label: 'Exams' },
  { key: 'enter-scores', label: 'Enter Scores' },
  { key: 'report-cards', label: 'Report Cards' },
  { key: 'class-ranking', label: 'Class Ranking' },
];

export default function ResultsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'SCHOOL_ADMIN';
  const canEnterScores = isAdmin || user.role === 'TEACHER';

  const [tab, setTab] = useState('exams');
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [error, setError] = useState('');

  // ---- Exams tab ----
  const [examForm, setExamForm] = useState({ academicYearId: '', classId: '', name: '', term: '' });
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [managingExamId, setManagingExamId] = useState(null);
  const [managingExam, setManagingExam] = useState(null);
  const [examSubjectForm, setExamSubjectForm] = useState({ subjectId: '', maxMarks: '100', passingMarks: '40' });
  const [isAddingExamSubject, setIsAddingExamSubject] = useState(false);

  // ---- Shared exam context for the other three tabs ----
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExam, setSelectedExam] = useState(null);

  // ---- Enter Scores tab ----
  const [selectedExamSubjectId, setSelectedExamSubjectId] = useState('');
  const [sheet, setSheet] = useState(null);
  const [isSavingResults, setIsSavingResults] = useState(false);

  // ---- Report Cards tab ----
  const [classStudents, setClassStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [reportCard, setReportCard] = useState(null);

  // ---- Class Ranking tab ----
  const [ranking, setRanking] = useState(null);

  async function refreshLookups() {
    const [yearList, classList, subjectList, examList] = await Promise.all([
      listAcademicYears(),
      listClasses(),
      listSubjects(),
      listExams(),
    ]);
    setYears(yearList);
    setClasses(classList);
    setSubjects(subjectList);
    setExams(examList);
  }

  useEffect(() => {
    refreshLookups().catch((err) => setError(err.response?.data?.message || 'Failed to load lookups'));
  }, []);

  // Loading a new exam resets everything derived from the previous one.
  useEffect(() => {
    setSelectedExamSubjectId('');
    setSheet(null);
    setSelectedStudentId('');
    setReportCard(null);
    setRanking(null);
    setClassStudents([]);

    if (!selectedExamId) {
      setSelectedExam(null);
      return;
    }
    getExam(selectedExamId)
      .then(async (exam) => {
        setSelectedExam(exam);
        setClassStudents(await listStudents({ classId: exam.class_id }).then((r) => r.items));
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load exam'));
  }, [selectedExamId]);

  useEffect(() => {
    if (!selectedExamSubjectId) {
      setSheet(null);
      return;
    }
    getResultsSheet(selectedExamSubjectId)
      .then(setSheet)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load results sheet'));
  }, [selectedExamSubjectId]);

  useEffect(() => {
    if (tab === 'class-ranking' && selectedExamId) {
      getClassReport(selectedExamId)
        .then(setRanking)
        .catch((err) => setError(err.response?.data?.message || 'Failed to load class ranking'));
    }
  }, [tab, selectedExamId]);

  const yearNameById = Object.fromEntries(years.map((y) => [y.id, y.name]));
  const classNameById = Object.fromEntries(classes.map((c) => [c.id, `${c.name}${c.section ? ` ${c.section}` : ''}`]));

  async function handleCreateExam(e) {
    e.preventDefault();
    setError('');
    setIsCreatingExam(true);
    try {
      await createExam(examForm);
      setExamForm({ academicYearId: '', classId: '', name: '', term: '' });
      setExams(await listExams());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create exam');
    } finally {
      setIsCreatingExam(false);
    }
  }

  async function openManageSubjects(examId) {
    setError('');
    setManagingExamId(examId);
    try {
      setManagingExam(await getExam(examId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load exam');
    }
  }

  async function handleAddExamSubject(e) {
    e.preventDefault();
    setError('');
    setIsAddingExamSubject(true);
    try {
      const updated = await addExamSubjects(managingExamId, [
        {
          subjectId: Number(examSubjectForm.subjectId),
          maxMarks: Number(examSubjectForm.maxMarks),
          passingMarks: Number(examSubjectForm.passingMarks),
        },
      ]);
      setManagingExam(updated);
      setExamSubjectForm({ subjectId: '', maxMarks: '100', passingMarks: '40' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add subject to exam');
    } finally {
      setIsAddingExamSubject(false);
    }
  }

  function setMark(studentId, field, value) {
    setSheet((prev) => ({
      ...prev,
      students: prev.students.map((s) => (s.student_id === studentId ? { ...s, [field]: value } : s)),
    }));
  }

  async function handleSaveResults() {
    setError('');
    setIsSavingResults(true);
    try {
      const records = sheet.students
        .filter((s) => s.marks_obtained !== null && s.marks_obtained !== '')
        .map((s) => ({
          studentId: s.student_id,
          marksObtained: Number(s.marks_obtained),
          remarks: s.remarks || undefined,
        }));
      const updated = await saveResults(selectedExamSubjectId, records);
      setSheet(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save results');
    } finally {
      setIsSavingResults(false);
    }
  }

  async function handleViewReportCard() {
    setError('');
    try {
      setReportCard(await getReportCard(selectedExamId, selectedStudentId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report card');
    }
  }

  return (
    <>
      <div className="max-w-5xl print:hidden">
        <h1 className="text-xl font-semibold text-slate-900 mb-6">Results &amp; Report Cards</h1>

        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 mb-4">
            {error}
          </p>
        )}

        {tab === 'exams' && (
          <div>
            {isAdmin && (
              <form
                onSubmit={handleCreateExam}
                className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Academic year</label>
                  <select
                    required
                    value={examForm.academicYearId}
                    onChange={(e) => setExamForm({ ...examForm, academicYearId: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
                  <select
                    required
                    value={examForm.classId}
                    onChange={(e) => setExamForm({ ...examForm, classId: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.section ? ` ${c.section}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                  <input
                    required
                    value={examForm.name}
                    onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                    placeholder="Term 1 Exam"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Term</label>
                  <input
                    value={examForm.term}
                    onChange={(e) => setExamForm({ ...examForm, term: e.target.value })}
                    placeholder="Term 1"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-28"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingExam}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isCreatingExam ? 'Adding…' : 'Add exam'}
                </button>
              </form>
            )}

            {exams.length === 0 ? (
              <p className="text-sm text-slate-500">No exams yet.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Term</th>
                    <th className="px-4 py-2">Class</th>
                    <th className="px-4 py-2">Academic year</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {exams.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{e.name}</td>
                      <td className="px-4 py-2">{e.term || '—'}</td>
                      <td className="px-4 py-2">{classNameById[e.class_id] || e.class_id}</td>
                      <td className="px-4 py-2">{yearNameById[e.academic_year_id] || e.academic_year_id}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => openManageSubjects(e.id)} className="text-indigo-600 text-xs font-medium">
                          Manage subjects
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}

            {managingExam && (
              <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4 max-w-lg">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Subjects for {managingExam.name}</h3>
                  <button
                    onClick={() => {
                      setManagingExamId(null);
                      setManagingExam(null);
                    }}
                    className="text-slate-400 text-xs"
                  >
                    Close
                  </button>
                </div>

                {managingExam.subjects.length === 0 ? (
                  <p className="text-sm text-slate-500 mb-3">No subjects added yet.</p>
                ) : (
                  <ul className="text-sm mb-3 space-y-1">
                    {managingExam.subjects.map((s) => (
                      <li key={s.exam_subject_id} className="flex justify-between text-slate-700">
                        <span>{s.subject_name}</span>
                        <span className="text-slate-500">
                          max {s.max_marks} / pass {s.passing_marks}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {isAdmin && (
                  <form onSubmit={handleAddExamSubject} className="flex flex-wrap gap-2 items-end border-t border-slate-200 pt-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                      <select
                        required
                        value={examSubjectForm.subjectId}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, subjectId: e.target.value })}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      >
                        <option value="" disabled>
                          Select…
                        </option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Max marks</label>
                      <input
                        type="number"
                        value={examSubjectForm.maxMarks}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, maxMarks: e.target.value })}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Passing marks</label>
                      <input
                        type="number"
                        value={examSubjectForm.passingMarks}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, passingMarks: e.target.value })}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-20"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isAddingExamSubject}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'enter-scores' && (
          <div>
            <div className="flex flex-wrap gap-3 items-end mb-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Exam</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Select…</option>
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({classNameById[e.class_id] || e.class_id})
                    </option>
                  ))}
                </select>
              </div>
              {selectedExam && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                  <select
                    value={selectedExamSubjectId}
                    onChange={(e) => setSelectedExamSubjectId(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">Select…</option>
                    {selectedExam.subjects.map((s) => (
                      <option key={s.exam_subject_id} value={s.exam_subject_id}>
                        {s.subject_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {sheet && (
              <>
                <div className="overflow-x-auto">
                <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-2">Admission No.</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">
                        Marks (max {sheet.examSubject.max_marks})
                      </th>
                      <th className="px-4 py-2">Grade</th>
                      <th className="px-4 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.students.map((s) => (
                      <tr key={s.student_id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{s.admission_no}</td>
                        <td className="px-4 py-2">
                          {s.first_name} {s.last_name}
                        </td>
                        <td className="px-4 py-2">
                          {canEnterScores ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={sheet.examSubject.max_marks}
                              value={s.marks_obtained ?? ''}
                              onChange={(e) => setMark(s.student_id, 'marks_obtained', e.target.value)}
                              className="rounded border border-slate-300 px-2 py-1 text-sm w-20"
                            />
                          ) : (
                            s.marks_obtained ?? '—'
                          )}
                        </td>
                        <td className="px-4 py-2">{s.grade || '—'}</td>
                        <td className="px-4 py-2">
                          {canEnterScores ? (
                            <input
                              value={s.remarks || ''}
                              onChange={(e) => setMark(s.student_id, 'remarks', e.target.value)}
                              className="rounded border border-slate-300 px-2 py-1 text-sm w-32"
                            />
                          ) : (
                            s.remarks || ''
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                {canEnterScores && (
                  <button
                    onClick={handleSaveResults}
                    disabled={isSavingResults}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSavingResults ? 'Saving…' : 'Save results'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'report-cards' && (
          <div>
            <div className="flex flex-wrap gap-3 items-end mb-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Exam</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Select…</option>
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({classNameById[e.class_id] || e.class_id})
                    </option>
                  ))}
                </select>
              </div>
              {selectedExam && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Student</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">Select…</option>
                    {classStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} ({s.admission_no})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedStudentId && (
                <button
                  onClick={handleViewReportCard}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  View report card
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'class-ranking' && (
          <div>
            <div className="mb-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Exam</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">Select…</option>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({classNameById[e.class_id] || e.class_id})
                  </option>
                ))}
              </select>
            </div>

            {ranking && (
              <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Position</th>
                    <th className="px-4 py-2">Student</th>
                    <th className="px-4 py-2">Total</th>
                    <th className="px-4 py-2">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr key={r.student_id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium">{r.position}</td>
                      <td className="px-4 py-2">
                        {r.first_name} {r.last_name} ({r.admission_no})
                      </td>
                      <td className="px-4 py-2">
                        {r.total_obtained} / {r.total_max}
                      </td>
                      <td className="px-4 py-2">
                        {r.total_max > 0 ? ((r.total_obtained / r.total_max) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
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

            <div className="overflow-x-auto">
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
            </div>

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
