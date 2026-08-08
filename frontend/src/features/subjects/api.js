import axiosClient from '../../api/axiosClient';

export async function listSubjects() {
  const { data } = await axiosClient.get('/subjects');
  return data.data;
}

export async function createSubject(payload) {
  const { data } = await axiosClient.post('/subjects', payload);
  return data.data;
}
