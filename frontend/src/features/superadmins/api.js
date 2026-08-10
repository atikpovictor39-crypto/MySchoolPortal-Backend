import axiosClient from '../../api/axiosClient';

export async function listSuperAdmins() {
  const { data } = await axiosClient.get('/superadmins');
  return data.data;
}

export async function createSuperAdmin(payload) {
  const { data } = await axiosClient.post('/superadmins', payload);
  return data.data;
}

export async function updateSuperAdminStatus(id, status) {
  const { data } = await axiosClient.patch(`/superadmins/${id}/status`, { status });
  return data.data;
}
