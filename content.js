// Berjalan di halaman Telegram Web (/k/). Tugasnya:
//  1. Menyisipkan item "Camera" ke menu attachment.
//  2. Membuka halaman kamera milik extension (camera.html) di jendela popup.
//  3. Menerima foto dari popup lalu mem-paste-nya ke Telegram (muncul dialog
//     preview/caption native Telegram).

const CAMERA_ICON = chrome.runtime.getURL("icons/icon38.png");
const CAMERA_PAGE = chrome.runtime.getURL("camera.html");

// Substring class ikon (tgico-*) khas item menu attachment webk.
const ATTACH_ICON_HINTS = ["image", "document", "poll", "media", "photo"];

/* ---------- 1. Sisipkan item Camera ke menu attachment ---------- */

function looksLikeAttachMenu(menu) {
  const items = menu.querySelectorAll(".btn-menu-item");
  if (items.length < 1) return false;

  for (const item of items) {
    if (item.id === "tg-camera-item") continue;
    const cls = item.className + " " + item.innerHTML;
    if (ATTACH_ICON_HINTS.some((h) => cls.includes("tgico-" + h) || cls.includes(h))) {
      return true;
    }
  }
  return false;
}

function scanForAttachMenu() {
  for (const menu of document.querySelectorAll(".btn-menu")) {
    if (menu.querySelector("#tg-camera-item")) continue;
    if (!looksLikeAttachMenu(menu)) continue;
    menu.appendChild(buildCameraItem());
  }
}

function buildCameraItem() {
  const item = document.createElement("div");
  item.id = "tg-camera-item";
  item.className = "btn-menu-item rp tg-camera-menu-item";
  item.innerHTML = `
    <span class="btn-menu-item-icon tg-camera-menu-icon">
      <img src="${CAMERA_ICON}" alt="">
    </span>
    <span class="btn-menu-item-text">Camera</span>
  `;

  item.addEventListener("click", (e) => {
    e.stopPropagation();
    document.body.click(); // tutup menu attachment (jangan pakai Escape!)
    openCameraPopup();
  });

  return item;
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

/* ---------- 3. Terima foto dari popup, paste ke Telegram ---------- */

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.tgCameraPhoto || !changes.tgCameraPhoto.newValue) return;

  const dataUrl = changes.tgCameraPhoto.newValue.dataUrl;
  chrome.storage.local.remove("tgCameraPhoto"); // bersihkan agar tidak terkirim ulang
  pasteDataUrlToTelegram(dataUrl);
});

const LOG = (...a) => console.log("%c[TG-CAM]", "color:#3390ec;font-weight:bold", ...a);

function pasteDataUrlToTelegram(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], `photo_${stamp()}.jpg`, { type: "image/jpeg" });

  window.focus();

  // Metode 1 (paling andal): suntik ke <input type=file> media milik Telegram.
  const fileInput = findMediaFileInput();
  if (fileInput) {
    LOG("inject ke file input | accept:", fileInput.accept || "(kosong)");
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  // Metode 2 (fallback): event paste sintetis ke kolom pesan.
  const input =
    document.querySelector(".input-message-input[contenteditable='true']") ||
    document.querySelector(".input-message-input") ||
    document.querySelector('[contenteditable="true"]');

  if (!input) {
    alert("Tidak menemukan kolom pesan Telegram. Buka sebuah chat dulu.");
    return;
  }

  LOG("tidak ada file input cocok -> pakai paste sintetis");
  input.focus();

  const dt = new DataTransfer();
  dt.items.add(file);
  const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(pasteEvent, "clipboardData", { value: dt });
  input.dispatchEvent(pasteEvent);
}

// Cari <input type=file> yang menerima gambar (input media Telegram), bukan
// input dokumen. Hanya kembalikan yang jelas untuk media.
function findMediaFileInput() {
  const inputs = [...document.querySelectorAll('input[type="file"]')];
  return (
    inputs.find((i) => /image|video/i.test(i.accept || "")) ||
    null
  );
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
