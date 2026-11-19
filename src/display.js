const root = document.documentElement;
const fullscreen = document.getElementById('fullscreen');
const install = document.getElementById('install');
const note = document.getElementById('display-note');
const standalone = matchMedia('(display-mode: standalone)');
const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const television = /Silk|Fire TV|AFT\w+|Smart[- ]?TV|Tizen|Web0S/i.test(navigator.userAgent);
let installPrompt;
let installed = false;

function sync() {
  fullscreen.textContent = document.fullscreenElement || document.webkitFullscreenElement
    ? 'Exit Fullscreen' : 'Fullscreen';
  install.hidden = installed || standalone.matches || navigator.standalone === true;
}

function showHelp(message) {
  note.textContent = message;
  note.scrollIntoView({ block: 'nearest' });
}

function installHelp() {
  if (!window.isSecureContext) return 'Open the HTTPS version of the game to install it.';
  if (appleMobile) return 'In Safari, tap Share, then Add to Home Screen. Enable Open as Web App if shown, then tap Add.';
  if (television) return 'Check the TV browser menu for an install option. If it has none, bookmark the game to return here.';
  return 'Open the browser menu and look for Install app, Add to Home Screen, or Add to Dock. If none appears, try Chrome or Edge.';
}

fullscreen.onclick = async () => {
  note.textContent = '';
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  const enter = root.requestFullscreen || root.webkitRequestFullscreen;
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) await exit.call(document);
    else if (enter && document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false) await enter.call(root);
    else if (appleMobile) showHelp(install.hidden ? 'The game is already open in its own window.' : installHelp());
    else showHelp('This browser controls fullscreen. Look for a fullscreen option in its menu.');
  } catch {
    showHelp('The browser blocked fullscreen. Open the game directly in its own tab and try again.');
  }
  sync();
};
for (const event of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(event, sync);
for (const event of ['fullscreenerror', 'webkitfullscreenerror']) document.addEventListener(event, () => {
  showHelp('The browser blocked fullscreen. Open the game directly in its own tab and try again.');
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  sync();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installed = true;
  note.textContent = 'Cubey & Canon is installed.';
  sync();
  if (!document.getElementById('display-actions').hidden) fullscreen.focus();
});
install.onclick = async () => {
  if (!installPrompt) {
    showHelp(installHelp());
    return;
  }
  const prompt = installPrompt;
  installPrompt = null;
  note.textContent = '';
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    showHelp(installHelp());
  }
};
standalone.addListener(sync);
sync();

if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline game unavailable', error));
}

export function showDisplayActions(visible) {
  document.getElementById('display-actions').hidden = !visible;
  note.textContent = '';
  sync();
}
