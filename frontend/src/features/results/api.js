import axiosClient from '../../api/axiosClient';

export async function listExams(classId) {
  const { data } = await axiosClient.get('/results/exams', { params: classId ? { classId } : {} });
  return data.data;
}

export async function getExam(id) {
  const { data } = await axiosClient.get(`/results/exams/${id}`);
  return data.data;
}

export async function createExam(payload) {
  const { data } = await axiosClient.post('/results/exams', payload);
  return data.data;
}

export async function addExamSubjects(examId, subjects) {
  const { data } = await axiosClient.post(`/results/exams/${examId}/subjects`, { subjects });
  return data.data;
}

export async function getResultsSheet(examSubjectId) {
  const { data } = await axiosClient.get(`/results/exam-subjects/${examSubjectId}`);
  return data.data;
}

export async function saveResults(examSubjectId, records) {
  const { data } = await axiosClient.post(`/results/exam-subjects/${examSubjectId}`, { records });
  return data.data;
}

export async function getReportCard(examId, studentId) {
  const { data } = await axiosClient.get(`/results/exams/${examId}/report-card/${studentId}`);
  return data.data;
}

export async function getClassReport(examId) {
  const { data } = await axiosClient.get(`/results/exams/${examId}/class-report`);
  return data.data;
}
