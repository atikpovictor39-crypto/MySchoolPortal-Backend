import axiosClient from '../../api/axiosClient';

export async function listSchools() {
  const { data } = await axiosClient.get('/schools');
  return data.data;
}

export async function createSchool(payload) {
  const { data } = await axiosClient.post('/schools', payload);
  return data.data;
}

export async function getPaymentDetails() {
  const { data } = await axiosClient.get('/schools/me/payment-details');
  return data.data;
}

export async function updatePaymentDetails(payload) {
  const { data } = await axiosClient.put('/schools/me/payment-details', payload);
  return data.data;
}
