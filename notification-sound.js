const G3D_NOTIFICATION_SOUND_URL = "./notificacao.mp3";
const G3D_NOTIFICATION_STATE_KEY = "g3d.notificationState.v1";

function g3dNotificationStorageKey(suffix) {
  return `${G3D_NOTIFICATION_STATE_KEY}.${state.session?.user?.id || "anon"}.${suffix}`;
}

function g3dGetNotificationSetting() {
  return localStorage.getItem(g3dNotificationStorageKey("enabled")) !== "off";
}

function g3dSetNotificationSetting(enabled) {
  localStorage.setItem(g3dNotificationStorageKey("enabled"), enabled ? "on" : "off");
}

function g3dFallbackTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close?.(), 420);
  } catch (_error) {}
}

async function g3dPlayNotificationSound() {
  if (!g3dGetNotificationSetting()) return;
  try {
    const audio = new Audio(G3D_NOTIFICATION_SOUND_URL);
    audio.preload = "auto";
    audio.volume = 0.55;
    await audio.play();
  } catch (_error) {
    g3dFallbackTone();
  }
}

function g3dNotify(message, options = {}) {
  const silent = options.silent === true;
  if (message && typeof showToast === "function") showToast(message);
  if (!silent) g3dPlayNotificationSound();
}

function g3dProductionSignature(rows = state.cache.producoes || []) {
  return rows.map(row => `${row.id}:${row.status || ""}:${row.etapa_atual || ""}`).sort().join("|");
}

function g3dAnnouncementSignature() {
  if (typeof visibleAnnouncements !== "function") return "";
  return visibleAnnouncements().map(item => `${item.id}:${item.updated_at || item.created_at || ""}`).sort().join("|");
}

function g3dCheckProductionChanges() {
  const key = g3dNotificationStorageKey("producoes");
  const current = g3dProductionSignature();
  if (!current) return;
  const previous = localStorage.getItem(key);
  localStorage.setItem(key, current);
  if (previous && previous !== current) g3dNotify("Produção mudou de fase.");
}

function g3dCheckAnnouncementChanges() {
  const key = g3dNotificationStorageKey("comunicados");
  const current = g3dAnnouncementSignature();
  if (!current) return;
  const previous = localStorage.getItem(key);
  localStorage.setItem(key, current);
  if (previous && previous !== current) g3dNotify("Novo comunicado ou atualização disponível.");
}

function g3dCheckAppUpdates() {
  g3dCheckProductionChanges();
  g3dCheckAnnouncementChanges();
}

function g3dAttachSoundToggle(root = document) {
  const topbar = root.querySelector?.(".topbar");
  if (!topbar || topbar.querySelector("#g3dSoundToggle")) return;
  const logout = topbar.querySelector("#logoutBtn");
  const button = document.createElement("button");
  button.className = "btn";
  button.type = "button";
  button.id = "g3dSoundToggle";
  button.textContent = g3dGetNotificationSetting() ? "Som ativo" : "Som off";
  button.title = "Ativar, desativar ou testar som de notificação";
  button.addEventListener("click", () => {
    const enabled = !g3dGetNotificationSetting();
    g3dSetNotificationSetting(enabled);
    button.textContent = enabled ? "Som ativo" : "Som off";
    if (enabled) g3dNotify("Notificações sonoras ativadas.");
    else showToast("Notificações sonoras desativadas.");
  });
  if (logout) topbar.insertBefore(button, logout);
  else topbar.appendChild(button);
}

if (typeof renderApp === "function") {
  const g3dPreviousRenderAppForSound = renderApp;
  renderApp = function renderAppWithSoundToggle() {
    g3dPreviousRenderAppForSound();
    g3dAttachSoundToggle(document);
  };
}

if (typeof loadAll === "function") {
  const g3dPreviousLoadAllForSound = loadAll;
  loadAll = async function loadAllWithNotificationCheck() {
    const result = await g3dPreviousLoadAllForSound();
    g3dCheckAppUpdates();
    return result;
  };
}

if (typeof loadTable === "function") {
  const g3dPreviousLoadTableForSound = loadTable;
  loadTable = async function loadTableWithNotificationCheck(table) {
    const result = await g3dPreviousLoadTableForSound(table);
    if (table === "producoes") g3dCheckProductionChanges();
    return result;
  };
}

if (typeof updateProductionStage === "function") {
  const g3dPreviousUpdateProductionStage = updateProductionStage;
  updateProductionStage = async function updateProductionStageWithSound(row, nextStatus, extra = {}) {
    const before = productionStageKey(row?.status || row?.etapa_atual || "fila");
    const result = await g3dPreviousUpdateProductionStage(row, nextStatus, extra);
    const after = productionStageKey(nextStatus || row?.status || row?.etapa_atual || "fila");
    if (before !== after) g3dPlayNotificationSound();
    return result;
  };
}

setInterval(() => {
  if (state.session) g3dCheckAppUpdates();
}, 90000);
