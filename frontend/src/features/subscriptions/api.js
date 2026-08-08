import axiosClient from '../../api/axiosClient';

export async function listPlans() {
  const { data } = await axiosClient.get('/subscriptions/plans');
  return data.data;
}

export async function createPlan(payload) {
  const { data } = await axiosClient.post('/subscriptions/plans', payload);
  return data.data;
}

export async function updatePlan(id, payload) {
  const { data } = await axiosClient.put(`/subscriptions/plans/${id}`, payload);
  return data.data;
}
