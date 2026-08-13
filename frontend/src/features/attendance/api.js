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

export async function getAttendanceReport(classId, fromDate, toDate) {
  const { data } = await axiosClient.get('/attendance/report', { params: { classId, fromDate, toDate } });
  return data.data;
}

// Same blob-download pattern as features/export/api.js — a plain <a href>
// won't carry the Authorization header the CSV endpoint needs.
export async function downloadAttendanceReport(classId, fromDate, toDate) {
  const { data } = await axiosClient.get('/attendance/report/export', {
    params: { classId, fromDate, toDate },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-report-${fromDate}-to-${toDate}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
