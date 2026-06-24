// Berjalan di halaman Telegram Web (/k/ webk maupun /a/ webz). Tugasnya:
//  1. Menyisipkan item "Camera" ke menu attachment.
//  2. Membuka halaman kamera milik extension (camera.html) di jendela popup.
//  3. Menerima foto dari popup lalu mem-paste-nya ke Telegram (muncul dialog
//     preview/caption native Telegram).

const CAMERA_ICON = chrome.runtime.getURL("icons/icon38.png");
const CAMERA_PAGE = chrome.runtime.getURL("camera.html");

// Substring class ikon khas item menu attachment (webk: tgico-*, webz: icon-*).
const ATTACH_ICON_HINTS = ["image", "document", "poll", "media", "photo"];

const IS_WEBZ = location.pathname.startsWith("/a/");

/* ---------- 1. Sisipkan item Camera ke menu attachment ---------- */

function scanForAttachMenu() {
  if (IS_WEBZ) scanWebZ();
  else scanWebK();
}

// --- webk (/k/) ---
function scanWebK() {
  for (const menu of document.querySelectorAll(".btn-menu")) {
    if (menu.querySelector("#tg-camera-item")) continue;
    if (!menuHasAttachIcon(menu, ".btn-menu-item")) continue;
    menu.appendChild(buildCameraItemK());
  }
}

function buildCameraItemK() {
  const item = document.createElement("div");
  item.id = "tg-camera-item";
  item.className = "btn-menu-item rp tg-camera-menu-item";
  item.innerHTML = `
    <span class="btn-menu-item-icon tg-camera-menu-icon">
      <img src="${CAMERA_ICON}" alt="">
    </span>
    <span class="btn-menu-item-text">Camera</span>
  `;
  item.addEventListener("click", onCameraItemClick);
  return item;
}

// --- webz (/a/) ---
function scanWebZ() {
  for (const menu of document.querySelectorAll(".Menu .bubble, .menu-container")) {
    if (menu.querySelector("#tg-camera-item")) continue;
    if (!menuHasAttachIcon(menu, ".MenuItem")) continue;
    menu.appendChild(buildCameraItemZ());
  }
}

function buildCameraItemZ() {
  const item = document.createElement("div");
  item.id = "tg-camera-item";
  item.className = "MenuItem compact tg-camera-menu-item-z";
  item.setAttribute("role", "menuitem");
  item.innerHTML = `
    <img class="tg-camera-menu-icon-z" src="${CAMERA_ICON}" alt="">
    <span>Camera</span>
  `;
  item.addEventListener("click", onCameraItemClick);
  return item;
}

// --- bersama ---
function menuHasAttachIcon(menu, itemSelector) {
  const items = menu.querySelectorAll(itemSelector);
  if (items.length < 1) return false;

  for (const item of items) {
    if (item.id === "tg-camera-item") continue;
    const cls = item.className + " " + item.innerHTML;
    if (ATTACH_ICON_HINTS.some((h) => cls.includes("tgico-" + h) || cls.includes("icon-" + h))) {
      return true;
    }
  }
  return false;
}

function onCameraItemClick(e) {
  e.stopPropagation();
  document.body.click(); // tutup menu attachment (jangan pakai Escape!)
  openCameraPopup();
}

let scanQueued = false;
function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scanForAttachMenu();
  });
}
new MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true });
scanForAttachMenu();

/* ---------- 2. Buka halaman kamera extension di popup ---------- */

let cameraWindow = null;

function openCameraPopup() {
  const w = 520, h = 680;
  const left = Math.max(0, Math.round((screen.width - w) / 2));
  const top = Math.max(0, Math.round((screen.height - h) / 2));

  cameraWindow = window.open(
    CAMERA_PAGE,
    "tg-camera",
    `width=${w},height=${h},left=${left},top=${top}`,
  );

  if (!cameraWindow) {
    alert("Popup kamera diblokir. Izinkan popup untuk web.telegram.org lalu coba lagi.");
  }
}

/* ---------- 3. Terima foto dari popup, teruskan ke main world ---------- */

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.tgCameraPhoto || !changes.tgCameraPhoto.newValue) return;

  const dataUrl = changes.tgCameraPhoto.newValue.dataUrl;
  chrome.storage.local.remove("tgCameraPhoto"); // bersihkan agar tidak terkirim ulang
  sendPhotoToTelegram(dataUrl);
});

// Telegram membaca clipboardData/dataTransfer di MAIN world. Karena content
// script di isolated world, kita kirim foto ke injected.js (MAIN world) yang
// akan men-dispatch event paste-nya di konteks yang sama dengan Telegram.
function sendPhotoToTelegram(dataUrl) {
  window.focus();
  window.postMessage({ __tgCam: "send-image", dataUrl, name: `photo_${stamp()}.jpg` }, "*");
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
