import axiosClient from '../../api/axiosClient';

export async function getAttendanceSheet(classId, date) {
  const { data } = await axiosClient.get('/attendance', { params: { class_id: classId, date } });
  return data.data; // { classId, date, students }
}

export async function markAttendance(classId, date, records) {
  const { data } = await axiosClient.post('/attendance/mark', { classId, date, records });
  return data.data;
}

export async function getAttendanceSummary(date) {
  const { data } = await axiosClient.get('/attendance/summary', { params: date ? { date } : {} });
  return data.data;
}
