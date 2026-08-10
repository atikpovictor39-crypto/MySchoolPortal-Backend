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

// ---- School side ----

export async function getMySubscription() {
  const { data } = await axiosClient.get('/subscriptions/mine');
  return data.data;
}

export async function startCheckout(planId) {
  const { data } = await axiosClient.post('/subscriptions/checkout', { planId });
  return data.data;
}

export async function getCheckoutStatus(externalRef) {
  const { data } = await axiosClient.get(`/subscriptions/checkout/${externalRef}`);
  return data.data;
}
