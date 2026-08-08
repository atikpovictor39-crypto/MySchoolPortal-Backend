import axiosClient from '../../api/axiosClient';

export async function listChildren() {
  const { data } = await axiosClient.get('/parent/children');
  return data.data;
}

export async function getChildAttendance(studentId) {
  const { data } = await axiosClient.get(`/parent/children/${studentId}/attendance`);
  return data.data;
}

export async function getChildExams(studentId) {
  const { data } = await axiosClient.get(`/parent/children/${studentId}/exams`);
  return data.data;
}

export async function getChildReportCard(studentId, examId) {
  const { data } = await axiosClient.get(`/parent/children/${studentId}/report-card/${examId}`);
  return data.data;
}

export async function getChildFees(studentId) {
  const { data } = await axiosClient.get(`/parent/children/${studentId}/fees`);
  return data.data;
}

export async function listAnnouncements() {
  const { data } = await axiosClient.get('/parent/announcements');
  return data.data;
}

export async function getChildHomework(studentId) {
  const { data } = await axiosClient.get(`/parent/children/${studentId}/homework`);
  return data.data;
}

export async function getChildTimetable(studentId) {
  const { data } = await axiosClient.get(`/parent/children/${studentId}/timetable`);
  return data.data;
}

export async function getChildOverview(studentId) {
  const { data } = await axiosClient.get(`/parent/children/${studentId}/overview`);
  return data.data;
}

export async function getPaymentDetails() {
  const { data } = await axiosClient.get('/parent/payment-details');
  return data.data;
}

export async function submitPaymentClaim(studentId, invoiceId, payload) {
  const { data } = await axiosClient.post(`/parent/children/${studentId}/fees/${invoiceId}/claims`, payload);
  return data.data;
}
