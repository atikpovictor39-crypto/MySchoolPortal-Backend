import axiosClient from '../../api/axiosClient';

export async function listAcademicYears() {
  const { data } = await axiosClient.get('/academic-years');
  return data.data;
}

export async function createAcademicYear(payload) {
  const { data } = await axiosClient.post('/academic-years', payload);
  return data.data;
}
