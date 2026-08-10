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
