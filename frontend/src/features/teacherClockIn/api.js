import axiosClient from '../../api/axiosClient';

export async function getMyStatus() {
  const { data } = await axiosClient.get('/teachers/clock-status');
  return data.data;
}

export async function clockIn() {
  const { data } = await axiosClient.post('/teachers/clock-in');
  return data.data;
}

export async function clockOut() {
  const { data } = await axiosClient.post('/teachers/clock-out');
  return data.data;
}

export async function listClockIns(params = {}) {
  const { data } = await axiosClient.get('/teachers/clock-ins', { params });
  return data.data;
}
