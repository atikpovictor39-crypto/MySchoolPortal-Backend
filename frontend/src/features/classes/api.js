import axiosClient from '../../api/axiosClient';

export async function listClasses(academicYearId) {
  const { data } = await axiosClient.get('/classes', {
    params: academicYearId ? { academicYearId } : {},
  });
  return data.data;
}

export async function createClass(payload) {
  const { data } = await axiosClient.post('/classes', payload);
  return data.data;
}

export async function updateClass(id, payload) {
  const { data } = await axiosClient.put(`/classes/${id}`, payload);
  return data.data;
}

export async function deleteClass(id) {
  await axiosClient.delete(`/classes/${id}`);
}
