import axiosClient from '../../api/axiosClient';

export async function listTimetable(classId) {
  const { data } = await axiosClient.get('/timetable', { params: classId ? { classId } : {} });
  return data.data;
}

export async function listForTeacher(teacherId) {
  const { data } = await axiosClient.get(`/timetable/teacher/${teacherId}`);
  return data.data;
}

export async function createSlot(payload) {
  const { data } = await axiosClient.post('/timetable', payload);
  return data.data;
}

export async function updateSlot(id, payload) {
  const { data } = await axiosClient.put(`/timetable/${id}`, payload);
  return data.data;
}

export async function deleteSlot(id) {
  await axiosClient.delete(`/timetable/${id}`);
}

export async function listSubstitutions({ date, classId }) {
  const { data } = await axiosClient.get('/timetable/substitutions', { params: { date, classId } });
  return data.data;
}

export async function createSubstitution(payload) {
  const { data } = await axiosClient.post('/timetable/substitutions', payload);
  return data.data;
}

export async function deleteSubstitution(id) {
  await axiosClient.delete(`/timetable/substitutions/${id}`);
}

export async function generateTimetable(payload) {
  const { data } = await axiosClient.post('/timetable/generate', payload);
  return data.data;
}
