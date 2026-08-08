import axiosClient from '../../api/axiosClient';

export async function listLeaveRequests(params = {}) {
  const { data } = await axiosClient.get('/teachers/leave-requests', { params });
  return data.data;
}

export async function createLeaveRequest(payload) {
  const { data } = await axiosClient.post('/teachers/leave-requests', payload);
  return data.data;
}

export async function approveLeaveRequest(id) {
  const { data } = await axiosClient.put(`/teachers/leave-requests/${id}/approve`);
  return data.data;
}

export async function rejectLeaveRequest(id) {
  const { data } = await axiosClient.put(`/teachers/leave-requests/${id}/reject`);
  return data.data;
}
