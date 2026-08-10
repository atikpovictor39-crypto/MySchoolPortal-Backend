import axiosClient from '../../api/axiosClient';

export async function getPlatformStatus() {
  const { data } = await axiosClient.get('/platform/status');
  return data.data;
}

export async function setMaintenanceMode(enabled, message) {
  const { data } = await axiosClient.patch('/platform/maintenance', { enabled, message });
  return data.data;
}

// Same authenticated-blob-download pattern as CSV export.
export async function downloadBackup() {
  const { data } = await axiosClient.get('/platform/backup', { responseType: 'blob' });
  const url = window.URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `myschoolportal-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function listPlatformAuditLogs(schoolId) {
  const { data } = await axiosClient.get('/platform/audit-logs', {
    params: schoolId ? { school_id: schoolId } : {},
  });
  return data.data;
}
