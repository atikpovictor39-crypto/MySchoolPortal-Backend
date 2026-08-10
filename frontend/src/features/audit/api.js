import axiosClient from '../../api/axiosClient';

export async function listAuditLogs() {
  const { data } = await axiosClient.get('/audit-logs');
  return data.data;
}
