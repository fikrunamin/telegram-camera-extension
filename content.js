// Menyisipkan item "Camera" ke dalam menu attachment Telegram Web (versi /k/).
// Tidak bergantung pada teks/aria-label tombol paperclip (yang berubah sesuai
// bahasa). Menu attachment dikenali dari ikon item bawaannya.

const CAMERA_ICON = chrome.runtime.getURL("icons/icon38.png");

// Substring class ikon (tgico-*) khas item menu attachment webk.
const ATTACH_ICON_HINTS = ["image", "document", "poll", "media", "photo"];

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
    // Tutup menu attachment dengan klik di luar (JANGAN pakai Escape —
    // di Telegram /k/ Escape menutup chat yang sedang dibuka).
    document.body.click();
    openTelegramCamera();
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
