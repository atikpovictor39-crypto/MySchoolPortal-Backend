import axiosClient from '../../api/axiosClient';

// ---- School side ----

export async function listMyTickets() {
  const { data } = await axiosClient.get('/tickets');
  return data.data;
}

export async function getMyTicket(id) {
  const { data } = await axiosClient.get(`/tickets/${id}`);
  return data.data;
}

export async function createTicket(payload) {
  const { data } = await axiosClient.post('/tickets', payload);
  return data.data;
}

export async function replyToMyTicket(id, message) {
  const { data } = await axiosClient.post(`/tickets/${id}/replies`, { message });
  return data.data;
}

// ---- SuperAdmin side ----

export async function listAllTickets(status) {
  const { data } = await axiosClient.get('/platform/tickets', { params: status ? { status } : {} });
  return data.data;
}

export async function getTicket(id) {
  const { data } = await axiosClient.get(`/platform/tickets/${id}`);
  return data.data;
}

export async function replyToTicket(id, message) {
  const { data } = await axiosClient.post(`/platform/tickets/${id}/replies`, { message });
  return data.data;
}

export async function updateTicketStatus(id, status) {
  const { data } = await axiosClient.patch(`/platform/tickets/${id}/status`, { status });
  return data.data;
}
