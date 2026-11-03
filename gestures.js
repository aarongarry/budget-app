// Keep the budget at its designed scale without blocking one-finger scrolling.
const preventZoom = event => {
  if (event.cancelable) event.preventDefault();
};

for (const type of ['gesturestart', 'gesturechange']) {
  document.addEventListener(type, preventZoom, { passive: false });
}
for (const type of ['touchstart', 'touchmove']) {
  document.addEventListener(type, event => {
    if (event.touches.length > 1) preventZoom(event);
  }, { passive: false });
}
document.addEventListener('wheel', event => {
  // Trackpad pinch is delivered as Ctrl+wheel in Chromium.
  if (event.ctrlKey) preventZoom(event);
}, { passive: false });
