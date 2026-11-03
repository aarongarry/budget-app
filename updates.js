export const VERSION = '1.3.1';
export const updateState = { available: false, checking: false, applying: false, message: 'Check for the latest version.' };
let registration, serverVersion = VERSION, lastCheck = 0, callbacks;
const emit = () => document.dispatchEvent(new CustomEvent('budget-update-status'));

function refreshAvailability() {
  updateState.available = Boolean(registration?.waiting) || (serverVersion !== VERSION && !registration?.installing);
  updateState.message = updateState.available ? 'An update is ready.' : registration?.installing ? 'Downloading update…' : 'You’re up to date.';
  emit();
}

export async function checkForUpdates(force = false) {
  if (updateState.checking || (!force && Date.now() - lastCheck < 60000)) return;
  lastCheck = Date.now();
  updateState.checking = true;
  updateState.message = 'Checking for updates…';
  emit();
  try {
    if (!navigator.onLine) throw Error('offline');
    if (registration) await registration.update();
    const response = await fetch('./version.json', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('unavailable');
    serverVersion = (await response.json()).version;
    refreshAvailability();
  } catch {
    updateState.message = navigator.onLine ? 'Couldn’t check. Try again when connected.' : 'Offline. Check again when connected.';
  } finally {
    updateState.checking = false;
    emit();
  }
}

export async function applyUpdate() {
  if (!updateState.available || updateState.applying) return;
  if (callbacks.isEditing()) return callbacks.notify('Finish your entry before updating.');
  await callbacks.sync();
  if (callbacks.hasPending()) return callbacks.notify('Connect and sync your saved changes before updating.');
  updateState.applying = true;
  updateState.message = 'Opening the latest version…';
  emit();
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(() => {
      if (!updateState.applying) return;
      updateState.applying = false;
      updateState.message = 'Update didn’t finish. Please try again.';
      emit();
    }, 10000);
  } else {
    location.reload();
  }
}

export async function initializeUpdates(options) {
  callbacks = options;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // A background update never reloads an open screen or an unfinished form.
      if (updateState.applying) location.reload();
      else refreshAvailability();
    });
    try {
      registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      const watch = () => {
        const worker = registration.installing;
        if (worker) worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' || worker.state === 'redundant') refreshAvailability();
        });
      };
      registration.addEventListener('updatefound', watch);
      watch();
    } catch {
      updateState.message = 'Updates need an internet connection.';
      emit();
    }
  }
  await checkForUpdates();
}
