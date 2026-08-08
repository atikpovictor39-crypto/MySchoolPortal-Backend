import axiosClient from '../../api/axiosClient';

export async function listStudents(params = {}) {
  const { data } = await axiosClient.get('/students', { params });
  return data.data; // { items, pagination }
}

export async function createStudent(payload) {
  const { data } = await axiosClient.post('/students', payload);
  return data.data;
}

export async function updateStudent(id, payload) {
  const { data } = await axiosClient.put(`/students/${id}`, payload);
  return data.data;
}

export async function listGuardians(studentId) {
  const { data } = await axiosClient.get(`/students/${studentId}/guardians`);
  return data.data;
}

export async function addGuardian(studentId, payload) {
  const { data } = await axiosClient.post(`/students/${studentId}/guardians`, payload);
  return data.data;
}
