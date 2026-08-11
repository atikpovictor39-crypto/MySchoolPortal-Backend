import axiosClient from '../../api/axiosClient';

export async function listTeachers() {
  const { data } = await axiosClient.get('/teachers');
  return data.data;
}

export async function createTeacher(payload) {
  const { data } = await axiosClient.post('/teachers', payload);
  return data.data;
}

export async function getMyTeacherProfile() {
  const { data } = await axiosClient.get('/teachers/me');
  return data.data;
}

export async function updateTeacher(id, payload) {
  const { data } = await axiosClient.put(`/teachers/${id}`, payload);
  return data.data;
}

export async function deleteTeacher(id) {
  await axiosClient.delete(`/teachers/${id}`);
}
