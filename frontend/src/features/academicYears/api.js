import axiosClient from '../../api/axiosClient';

export async function listAcademicYears() {
  const { data } = await axiosClient.get('/academic-years');
  return data.data;
}

export async function listAcademicYearsWithStats() {
  const { data } = await axiosClient.get('/academic-years', { params: { withStats: 'true' } });
  return data.data;
}

export async function createAcademicYear(payload) {
  const { data } = await axiosClient.post('/academic-years', payload);
  return data.data;
}

export async function updateAcademicYear(id, payload) {
  const { data } = await axiosClient.put(`/academic-years/${id}`, payload);
  return data.data;
}

export async function deleteAcademicYear(id) {
  await axiosClient.delete(`/academic-years/${id}`);
}
