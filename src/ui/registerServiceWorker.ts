export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return null;
  try {
    return await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    });
  } catch (error) {
    console.warn('[Neon Drift] Offline mode could not be enabled.', error);
    return null;
  }
}

if (document.readyState === 'complete') {
  void registerServiceWorker();
} else {
  window.addEventListener(
    'load',
    () => {
      void registerServiceWorker();
    },
    { once: true },
  );
}
