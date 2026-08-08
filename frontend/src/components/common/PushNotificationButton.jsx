import { useEffect, useState } from 'react';
import { getPublicKey, subscribe, unsubscribe } from '../../features/push/api';

const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function PushNotificationButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(Boolean(sub)))
      .catch(() => {});
  }, []);

  async function handleEnable() {
    setError('');
    setIsBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission was not granted.');
        return;
      }
      const publicKey = await getPublicKey();
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await subscribe(subscription.toJSON());
      setIsSubscribed(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to enable notifications');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDisable() {
    setError('');
    setIsBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      setError(err.message || 'Failed to disable notifications');
    } finally {
      setIsBusy(false);
    }
  }

  if (!isSupported) return null;

  return (
    <div>
      <button
        onClick={isSubscribed ? handleDisable : handleEnable}
        disabled={isBusy}
        className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
      >
        {isSubscribed ? 'Disable notifications' : 'Enable notifications'}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
