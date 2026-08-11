import axiosClient from '../../api/axiosClient';

export async function listSubjects() {
  const { data } = await axiosClient.get('/subjects');
  return data.data;
}

export async function createSubject(payload) {
  const { data } = await axiosClient.post('/subjects', payload);
  return data.data;
}

export async function updateSubject(id, payload) {
  const { data } = await axiosClient.put(`/subjects/${id}`, payload);
  return data.data;
}

export async function deleteSubject(id) {
  await axiosClient.delete(`/subjects/${id}`);
}
