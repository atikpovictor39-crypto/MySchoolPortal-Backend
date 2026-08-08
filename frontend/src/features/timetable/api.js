import axiosClient from '../../api/axiosClient';

export async function listTimetable(classId) {
  const { data } = await axiosClient.get('/timetable', { params: classId ? { classId } : {} });
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
