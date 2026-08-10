import axiosClient from '../../api/axiosClient';

export async function listNotifications() {
  const { data } = await axiosClient.get('/notifications');
  return data.data;
}

export async function getUnreadCount() {
  const { data } = await axiosClient.get('/notifications/unread-count');
  return data.data.count;
}

export async function markNotificationRead(id) {
  const { data } = await axiosClient.patch(`/notifications/${id}/read`);
  return data.data;
}

export async function markAllNotificationsRead() {
  await axiosClient.post('/notifications/mark-all-read');
}
