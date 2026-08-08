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
