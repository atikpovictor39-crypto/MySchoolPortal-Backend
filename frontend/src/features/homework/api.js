import axiosClient from '../../api/axiosClient';

export async function listHomework(params = {}) {
  const { data } = await axiosClient.get('/homework', { params });
  return data.data;
}

export async function createHomework(payload) {
  const { data } = await axiosClient.post('/homework', payload);
  return data.data;
}

export async function updateHomework(id, payload) {
  const { data } = await axiosClient.put(`/homework/${id}`, payload);
  return data.data;
}

export async function deleteHomework(id) {
  await axiosClient.delete(`/homework/${id}`);
}
