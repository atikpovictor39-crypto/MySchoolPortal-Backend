import axiosClient from '../../api/axiosClient';

export async function listFeeStructures() {
  const { data } = await axiosClient.get('/fees/structures');
  return data.data;
}

export async function createFeeStructure(payload) {
  const { data } = await axiosClient.post('/fees/structures', payload);
  return data.data;
}

export async function generateInvoices(structureId) {
  const { data } = await axiosClient.post(`/fees/structures/${structureId}/generate-invoices`);
  return data.data;
}

export async function listInvoices(params = {}) {
  const { data } = await axiosClient.get('/fees/invoices', { params });
  return data.data;
}

export async function getInvoice(id) {
  const { data } = await axiosClient.get(`/fees/invoices/${id}`);
  return data.data;
}

export async function recordPayment(invoiceId, payload) {
  const { data } = await axiosClient.post(`/fees/invoices/${invoiceId}/payments`, payload);
  return data.data;
}

export async function listDebtors() {
  const { data } = await axiosClient.get('/fees/debtors');
  return data.data;
}
