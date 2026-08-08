import axiosClient from '../../api/axiosClient';

export async function listAnnouncements(params = {}) {
  const { data } = await axiosClient.get('/announcements', { params });
  return data.data;
}

export async function createAnnouncement(payload) {
  const { data } = await axiosClient.post('/announcements', payload);
  return data.data;
}

export async function updateAnnouncement(id, payload) {
  const { data } = await axiosClient.put(`/announcements/${id}`, payload);
  return data.data;
}

export async function deleteAnnouncement(id) {
  await axiosClient.delete(`/announcements/${id}`);
}
