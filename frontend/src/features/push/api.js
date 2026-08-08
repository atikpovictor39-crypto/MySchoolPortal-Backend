import axiosClient from '../../api/axiosClient';

export async function getPublicKey() {
  const { data } = await axiosClient.get('/push/public-key');
  return data.data.publicKey;
}

export async function subscribe(subscription) {
  await axiosClient.post('/push/subscribe', subscription);
}

export async function unsubscribe(endpoint) {
  await axiosClient.post('/push/unsubscribe', { endpoint });
}
