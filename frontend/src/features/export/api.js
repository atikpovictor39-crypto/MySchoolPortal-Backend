import axiosClient from '../../api/axiosClient';

// Downloads straight to the browser's Downloads folder — a plain <a href>
// won't carry the Authorization header, so this fetches the CSV as a blob
// and triggers the save via a throwaway object URL instead.
export async function downloadExport(type, filename) {
  const { data } = await axiosClient.get(`/export/${type}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
