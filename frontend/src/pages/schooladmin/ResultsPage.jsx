import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Tabs from '../../components/common/Tabs';
import { listAcademicYears } from '../../features/academicYears/api';
import { listClasses } from '../../features/classes/api';
import { listSubjects } from '../../features/subjects/api';
import { listStudents } from '../../features/students/api';
import { getMyProfile } from '../../features/schools/api';
import {
  listExams,
  getExam,
  createExam,
  updateExam,
  addExamSubjects,
  saveResults,
  getReportCard,
  getClassReport,
  saveReportCardNotes,
} from '../../features/results/api';

const emptyExamForm = { academicYearId: '', classId: '', name: '', term: '', termStartDate: '', termEndDate: '', reopeningDate: '' };
const emptyNotesForm = {
  interest: '',
  academicStrength: '',
  classTeacherRemarks: '',
  headmasterRemarks: '',
  promotedTo: '',
};
const emptyExamFieldsForm = { vacationDate: '', teacherName: '', teacherSignature: '', teacherSignedDate: '' };

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
  const canManageExamSubjects = isAdmin || user.role === 'TEACHER';
  // Class teachers normally fill in interest/academic strength/their own
  // remarks/promoted-to; headmaster's remarks stays admin-only (see the
  // matching field-level restriction in result.controller.js).
  const canEditNotes = canEnterScores;

  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('exams');
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [error, setError] = useState('');
  // Lets the Classes page's "Results" quick action land here with the
  // Exams list pre-filtered to that class.
  const [examClassFilter, setExamClassFilter] = useState(searchParams.get('classId') || '');

  // ---- Exams tab ----
  const [examForm, setExamForm] = useState(emptyExamForm);
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [managingExamId, setManagingExamId] = useState(null);
  const [managingExam, setManagingExam] = useState(null);
  const [examSubjectForm, setExamSubjectForm] = useState({ subjectId: '', maxMarks: '100', passingMarks: '40' });
  const [isAddingExamSubject, setIsAddingExamSubject] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [editExamForm, setEditExamForm] = useState({});
  const [isSavingExam, setIsSavingExam] = useState(false);

  // ---- Shared exam context for the other three tabs ----
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExam, setSelectedExam] = useState(null);

  // ---- Enter Scores tab ----
  // Student-first, not subject-first: picking a student surfaces every
  // subject on the exam in one table so a class teacher can fill in all of
  // that student's marks and save once, instead of switching subjects and
  // re-scanning the whole class roster each time.
  const [scoreStudentId, setScoreStudentId] = useState('');
  const [scoreSubjects, setScoreSubjects] = useState(null);
  const [isSavingResults, setIsSavingResults] = useState(false);

  // ---- Report Cards tab ----
  const [classStudents, setClassStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [reportCard, setReportCard] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [notesForm, setNotesForm] = useState(emptyNotesForm);
  // Exam-level fields (shared by every student in the exam, unlike notesForm
  // above which is per-student) — vacation date plus the class teacher's own
  // name/signature/date, editable by admin or teacher alongside the notes.
  const [examFieldsForm, setExamFieldsForm] = useState(emptyExamFieldsForm);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // ---- Class Ranking tab ----
  const [ranking, setRanking] = useState(null);

  async function refreshLookups() {
    const [yearList, classList, subjectList, examList, profile] = await Promise.all([
      listAcademicYears(),
      listClasses(),
      listSubjects(),
      listExams(),
      getMyProfile(),
    ]);
    setYears(yearList);
    setClasses(classList);
    setSubjects(subjectList);
    setExams(examList);
    setSchoolProfile(profile);
  }

  useEffect(() => {
    refreshLookups().catch((err) => setError(err.response?.data?.message || 'Failed to load lookups'));
  }, []);

  // Loading a new exam resets everything derived from the previous one.
  useEffect(() => {
    setScoreStudentId('');
    setScoreSubjects(null);
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
    if (!scoreStudentId) {
      setScoreSubjects(null);
      return;
    }
    getReportCard(selectedExamId, scoreStudentId)
      .then((card) => setScoreSubjects(card.subjects))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load subjects for this student'));
  }, [scoreStudentId]);

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
      setExamForm(emptyExamForm);
      setExams(await listExams());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create exam');
    } finally {
      setIsCreatingExam(false);
    }
  }

  // Vacation/re-opening dates are usually only confirmed near the end of
  // term, so this is normally used after the exam already exists rather
  // than at creation time.
  function startEditExam(exam) {
    setEditingExamId(exam.id);
    setEditExamForm({
      name: exam.name,
      term: exam.term || '',
      termStartDate: exam.term_start_date?.slice(0, 10) || '',
      termEndDate: exam.term_end_date?.slice(0, 10) || '',
      reopeningDate: exam.reopening_date?.slice(0, 10) || '',
    });
  }

  async function saveEditExam() {
    setError('');
    setIsSavingExam(true);
    try {
      await updateExam(editingExamId, editExamForm);
      setEditingExamId(null);
      setExams(await listExams());
      if (Number(selectedExamId) === editingExamId) {
        setSelectedExam(await getExam(editingExamId));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update exam');
    } finally {
      setIsSavingExam(false);
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

  function setSubjectMark(examSubjectId, field, value) {
    setScoreSubjects((prev) =>
      prev.map((s) => (s.exam_subject_id === examSubjectId ? { ...s, [field]: value } : s))
    );
  }

  // Saves every subject with a mark entered for the one selected student.
  // saveResults is a per-subject endpoint (records for many students, one
  // subject), so entering all of one student's subjects at once still means
  // firing it once per subject here — the teacher just does it in one click
  // instead of switching subjects and re-finding the student each time.
  async function handleSaveResults() {
    setError('');
    setIsSavingResults(true);
    try {
      const toSave = scoreSubjects.filter((s) => s.marks_obtained !== null && s.marks_obtained !== '');
      await Promise.all(
        toSave.map((s) =>
          saveResults(s.exam_subject_id, [
            { studentId: scoreStudentId, marksObtained: Number(s.marks_obtained), remarks: s.remarks || undefined },
          ])
        )
      );
      const card = await getReportCard(selectedExamId, scoreStudentId);
      setScoreSubjects(card.subjects);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save results');
    } finally {
      setIsSavingResults(false);
    }
  }

  async function handleViewReportCard() {
    setError('');
    try {
      const card = await getReportCard(selectedExamId, selectedStudentId);
      setReportCard(card);
      setNotesForm({
        interest: card.notes.interest || '',
        academicStrength: card.notes.academic_strength || '',
        classTeacherRemarks: card.notes.class_teacher_remarks || '',
        headmasterRemarks: card.notes.headmaster_remarks || '',
        promotedTo: card.notes.promoted_to || '',
      });
      setExamFieldsForm({
        vacationDate: card.exam.term_end_date?.slice(0, 10) || '',
        // Pre-fills with the auto-derived class teacher name as a starting
        // point — saving without changing it just confirms that name as the
        // explicit override going forward.
        teacherName: card.exam.teacher_name || card.classTeacherName || '',
        teacherSignature: card.exam.teacher_signature || '',
        teacherSignedDate: card.exam.teacher_signed_date?.slice(0, 10) || '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report card');
    }
  }

  async function handleSaveNotes() {
    setError('');
    setIsSavingNotes(true);
    try {
      const [notes, exam] = await Promise.all([
        saveReportCardNotes(selectedExamId, selectedStudentId, notesForm),
        updateExam(selectedExamId, {
          termEndDate: examFieldsForm.vacationDate || null,
          teacherName: examFieldsForm.teacherName || null,
          teacherSignature: examFieldsForm.teacherSignature || null,
          teacherSignedDate: examFieldsForm.teacherSignedDate || null,
        }),
      ]);
      setReportCard((prev) => ({ ...prev, notes, exam }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  }

  return (
    <>
      <div className="max-w-5xl print:hidden">
        <h1 className="text-xl font-semibold text-slate-900 mb-6">Results &amp; Report Cards</h1>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

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
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Term start (optional)</label>
                  <input
                    type="date"
                    value={examForm.termStartDate}
                    onChange={(e) => setExamForm({ ...examForm, termStartDate: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vacation date (optional)</label>
                  <input
                    type="date"
                    value={examForm.termEndDate}
                    onChange={(e) => setExamForm({ ...examForm, termEndDate: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Re-opening date (optional)</label>
                  <input
                    type="date"
                    value={examForm.reopeningDate}
                    onChange={(e) => setExamForm({ ...examForm, reopeningDate: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingExam}
                  className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreatingExam ? 'Adding…' : 'Add exam'}
                </button>
              </form>
            )}
            {isAdmin && (
              <p className="text-xs text-slate-400 -mt-6 mb-6">
                Term dates can also be filled in later, once vacation/re-opening are confirmed — use Edit on the exam
                below. The term start/vacation dates are what "no. of times present/absent" on report cards are
                counted over.
              </p>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Filter by class</label>
              <select
                value={examClassFilter}
                onChange={(e) => setExamClassFilter(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.section ? ` ${c.section}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {exams.filter((e) => !examClassFilter || String(e.class_id) === String(examClassFilter)).length === 0 ? (
              <p className="text-sm text-slate-500">{examClassFilter ? 'No exams for this class yet.' : 'No exams yet.'}</p>
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
                  {exams
                    .filter((e) => !examClassFilter || String(e.class_id) === String(examClassFilter))
                    .map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{e.name}</td>
                      <td className="px-4 py-2">{e.term || '—'}</td>
                      <td className="px-4 py-2">{classNameById[e.class_id] || e.class_id}</td>
                      <td className="px-4 py-2">{yearNameById[e.academic_year_id] || e.academic_year_id}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-3">
                          <button onClick={() => openManageSubjects(e.id)} className="text-blue-600 text-xs font-medium">
                            Manage subjects
                          </button>
                          {isAdmin && (
                            <button onClick={() => startEditExam(e)} className="text-blue-600 text-xs font-medium">
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}

            {editingExamId && (
              <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4 max-w-lg space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-900">Edit exam</h3>
                  <button onClick={() => setEditingExamId(null)} className="text-slate-400 text-xs">
                    Close
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                    <input
                      value={editExamForm.name}
                      onChange={(e) => setEditExamForm({ ...editExamForm, name: e.target.value })}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Term</label>
                    <input
                      value={editExamForm.term}
                      onChange={(e) => setEditExamForm({ ...editExamForm, term: e.target.value })}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-28"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Term start</label>
                    <input
                      type="date"
                      value={editExamForm.termStartDate}
                      onChange={(e) => setEditExamForm({ ...editExamForm, termStartDate: e.target.value })}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Vacation date</label>
                    <input
                      type="date"
                      value={editExamForm.termEndDate}
                      onChange={(e) => setEditExamForm({ ...editExamForm, termEndDate: e.target.value })}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Re-opening date</label>
                    <input
                      type="date"
                      value={editExamForm.reopeningDate}
                      onChange={(e) => setEditExamForm({ ...editExamForm, reopeningDate: e.target.value })}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <button
                    onClick={saveEditExam}
                    disabled={isSavingExam}
                    className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSavingExam ? 'Saving…' : 'Save'}
                  </button>
                </div>
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

                {canManageExamSubjects && (
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
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">Student</label>
                  <select
                    value={scoreStudentId}
                    onChange={(e) => setScoreStudentId(e.target.value)}
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
            </div>

            {scoreSubjects && (
              <>
                {scoreSubjects.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No subjects have been added to this exam yet — add some under the Exams tab first.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
                      <thead className="bg-slate-50 text-left text-slate-600">
                        <tr>
                          <th className="px-4 py-2">Subject</th>
                          <th className="px-4 py-2">Marks</th>
                          <th className="px-4 py-2">Grade</th>
                          <th className="px-4 py-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoreSubjects.map((s) => (
                          <tr key={s.exam_subject_id} className="border-t border-slate-100">
                            <td className="px-4 py-2 uppercase">{s.subject_name}</td>
                            <td className="px-4 py-2">
                              {canEnterScores ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={s.max_marks}
                                  value={s.marks_obtained ?? ''}
                                  onChange={(e) => setSubjectMark(s.exam_subject_id, 'marks_obtained', e.target.value)}
                                  className="rounded border border-slate-300 px-2 py-1 text-sm w-20"
                                />
                              ) : (
                                s.marks_obtained ?? '—'
                              )}
                              <span className="text-xs text-slate-400 ml-1">/ {s.max_marks}</span>
                            </td>
                            <td className="px-4 py-2">{s.grade || '—'}</td>
                            <td className="px-4 py-2">
                              {canEnterScores ? (
                                <input
                                  value={s.remarks || ''}
                                  onChange={(e) => setSubjectMark(s.exam_subject_id, 'remarks', e.target.value)}
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
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSavingResults ? 'Saving…' : 'Save results'}
                      </button>
                    )}
                  </>
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
                  className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
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
        <div className="fixed inset-0 z-50 bg-black/40 print:static print:bg-transparent">
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl p-4 sm:p-6 print:static print:translate-x-0 print:translate-y-0 print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:shadow-none print:p-0">
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

            {/* Student / term info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-4">
              <p>
                <span className="font-semibold">Name of Student: </span>
                {reportCard.student.first_name} {reportCard.student.last_name}
              </p>
              <p>
                <span className="font-semibold">Year: </span>
                {yearNameById[reportCard.exam.academic_year_id] || reportCard.exam.academic_year_id}
              </p>
              <p>
                <span className="font-semibold">Class: </span>
                {classNameById[reportCard.exam.class_id] || reportCard.exam.class_id}
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
              <p className="flex items-center gap-1">
                <span className="font-semibold shrink-0">Vacation Date: </span>
                {canEditNotes ? (
                  <input
                    type="date"
                    value={examFieldsForm.vacationDate}
                    onChange={(e) => setExamFieldsForm({ ...examFieldsForm, vacationDate: e.target.value })}
                    className="print:hidden min-w-0 w-full rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                  />
                ) : null}
                <span className={canEditNotes ? 'hidden print:inline' : ''}>
                  {examFieldsForm.vacationDate || '—'}
                </span>
              </p>
              <p>
                <span className="font-semibold">Re-opening Date: </span>
                {reportCard.exam.reopening_date ? reportCard.exam.reopening_date.slice(0, 10) : '—'}
              </p>
              <p>
                <span className="font-semibold">Term: </span>
                {reportCard.exam.term || '—'}
              </p>
              <p className="flex items-center gap-1">
                <span className="font-semibold shrink-0">Promoted To: </span>
                {canEditNotes ? (
                  <input
                    value={notesForm.promotedTo}
                    onChange={(e) => setNotesForm({ ...notesForm, promotedTo: e.target.value })}
                    className="print:hidden flex-1 min-w-0 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                  />
                ) : null}
                <span className={canEditNotes ? 'hidden print:inline' : ''}>{notesForm.promotedTo || '—'}</span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm mb-3 border border-slate-300 print:border-slate-800">
                <thead className="text-left bg-slate-50 print:bg-transparent">
                  <tr>
                    <th className="py-1.5 px-2 border-b border-slate-300 print:border-slate-800">Subjects</th>
                    <th className="py-1.5 px-2 border-b border-slate-300 print:border-slate-800">Marks</th>
                    {schoolProfile?.show_grades_on_report_card && (
                      <th className="py-1.5 px-2 border-b border-slate-300 print:border-slate-800">Grade</th>
                    )}
                    <th className="py-1.5 px-2 border-b border-slate-300 print:border-slate-800">Position</th>
                    <th className="py-1.5 px-2 border-b border-slate-300 print:border-slate-800">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {reportCard.subjects.map((s) => (
                    <tr key={s.exam_subject_id} className="border-b border-slate-200">
                      <td className="py-1 px-2 uppercase">{s.subject_name}</td>
                      <td className="py-1 px-2">{s.marks_obtained !== null ? s.marks_obtained : '—'}</td>
                      {schoolProfile?.show_grades_on_report_card && <td className="py-1 px-2">{s.grade || '—'}</td>}
                      <td className="py-1 px-2">{s.position ? `${s.position}${ordinalSuffix(s.position)}` : '—'}</td>
                      <td className="py-1 px-2">{s.remarks || ''}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1 px-2">Total</td>
                    <td className="py-1 px-2">{reportCard.totalObtained}</td>
                    {schoolProfile?.show_grades_on_report_card && (
                      <td className="py-1 px-2">{reportCard.overallGrade || '—'}</td>
                    )}
                    <td className="py-1 px-2">
                      {reportCard.position ? `${reportCard.position}${ordinalSuffix(reportCard.position)}` : '—'}
                    </td>
                    <td className="py-1 px-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Interest / academic strength / attendance summary */}
            <div className="text-sm space-y-1 mb-3">
              <p className="flex items-center gap-1">
                <span className="font-semibold shrink-0">Interest: </span>
                {canEditNotes ? (
                  <input
                    value={notesForm.interest}
                    onChange={(e) => setNotesForm({ ...notesForm, interest: e.target.value })}
                    className="print:hidden flex-1 min-w-0 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                  />
                ) : null}
                <span className={canEditNotes ? 'hidden print:inline' : ''}>{notesForm.interest || '—'}</span>
              </p>
              <p className="flex items-center gap-1">
                <span className="font-semibold shrink-0">Academic Strength: </span>
                {canEditNotes ? (
                  <input
                    value={notesForm.academicStrength}
                    onChange={(e) => setNotesForm({ ...notesForm, academicStrength: e.target.value })}
                    className="print:hidden flex-1 min-w-0 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                  />
                ) : null}
                <span className={canEditNotes ? 'hidden print:inline' : ''}>{notesForm.academicStrength || '—'}</span>
              </p>
              <p>
                <span className="font-semibold">Attendance: </span>
                {reportCard.attendance.total !== null
                  ? `${reportCard.attendance.present} out of ${reportCard.attendance.total}`
                  : 'Not available — set the exam\'s term dates to enable this'}
              </p>
            </div>

            {/* Class teacher */}
            <div className="text-sm mb-3">
              <p className="font-semibold mb-1">Class Teacher's Remarks:</p>
              {canEditNotes ? (
                <textarea
                  rows={2}
                  value={notesForm.classTeacherRemarks}
                  onChange={(e) => setNotesForm({ ...notesForm, classTeacherRemarks: e.target.value })}
                  className="print:hidden w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              ) : null}
              <p className={`whitespace-pre-wrap ${canEditNotes ? 'hidden print:block' : ''}`}>
                {notesForm.classTeacherRemarks || '—'}
              </p>
              <div className="flex flex-wrap justify-between items-end mt-2 gap-3 text-xs">
                <p className="flex items-center gap-1">
                  <span className="shrink-0">Teacher's Name: </span>
                  {canEditNotes ? (
                    <input
                      value={examFieldsForm.teacherName}
                      onChange={(e) => setExamFieldsForm({ ...examFieldsForm, teacherName: e.target.value })}
                      className="print:hidden rounded border border-slate-300 px-1.5 py-0.5 text-xs w-36"
                    />
                  ) : null}
                  <span className={canEditNotes ? 'hidden print:inline' : ''}>
                    {examFieldsForm.teacherName || '_______________________'}
                  </span>
                </p>
                <p className="flex items-center gap-1">
                  <span className="shrink-0">Signature: </span>
                  {canEditNotes ? (
                    <input
                      value={examFieldsForm.teacherSignature}
                      onChange={(e) => setExamFieldsForm({ ...examFieldsForm, teacherSignature: e.target.value })}
                      className="print:hidden rounded border border-slate-300 px-1.5 py-0.5 text-xs w-32"
                    />
                  ) : null}
                  <span className={canEditNotes ? 'hidden print:inline' : ''}>
                    {examFieldsForm.teacherSignature || '_______________________'}
                  </span>
                </p>
                <p className="flex items-center gap-1">
                  <span className="shrink-0">Date: </span>
                  {canEditNotes ? (
                    <input
                      type="date"
                      value={examFieldsForm.teacherSignedDate}
                      onChange={(e) => setExamFieldsForm({ ...examFieldsForm, teacherSignedDate: e.target.value })}
                      className="print:hidden rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                    />
                  ) : null}
                  <span className={canEditNotes ? 'hidden print:inline' : ''}>
                    {examFieldsForm.teacherSignedDate || '_______________________'}
                  </span>
                </p>
              </div>
            </div>

            {/* Headmaster */}
            <div className="text-sm mb-2">
              <p className="font-semibold mb-1">Headmaster's Remarks:</p>
              {canEditNotes ? (
                <textarea
                  rows={2}
                  value={notesForm.headmasterRemarks}
                  onChange={(e) => setNotesForm({ ...notesForm, headmasterRemarks: e.target.value })}
                  className="print:hidden w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              ) : null}
              <p className={`whitespace-pre-wrap ${canEditNotes ? 'hidden print:block' : ''}`}>
                {notesForm.headmasterRemarks || '—'}
              </p>
              <div className="flex justify-between items-end mt-2 text-xs gap-4">
                <p>
                  Headmaster's Signature: {schoolProfile?.headmaster_signature || '_______________________'}
                </p>
              </div>
              {isAdmin && !schoolProfile?.headmaster_signature && (
                <p className="print:hidden text-xs text-slate-400 mt-1">
                  Set the headmaster's signature once in School Details — it then applies to every student's report
                  card automatically.
                </p>
              )}
            </div>

            {canEditNotes && (
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="print:hidden rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 mt-2"
              >
                {isSavingNotes ? 'Saving…' : 'Save'}
              </button>
            )}
            <button onClick={() => window.print()} className="print:hidden mt-2 ml-3 text-sm text-blue-600 underline">
              Print report card
            </button>
          </div>
        </div>
      )}
    </>
  );
}
