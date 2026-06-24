// Halaman kamera milik extension (chrome-extension://). Bebas dari batasan
// halaman Telegram. Ambil foto -> (opsi self-timer) -> langsung kirim dataURL
// ke tab Telegram (lewat chrome.storage) lalu tutup. Preview & caption
// ditangani dialog native Telegram.

const video = document.getElementById("video");
const status = document.getElementById("status");
const countdown = document.getElementById("countdown");

const shutterBtn = document.getElementById("shutter");
const cancelBtn = document.getElementById("cancel");
const mirrorBtn = document.getElementById("mirror");
const timerBtn = document.getElementById("timer");
const switchBtn = document.getElementById("switch");
const ratioSel = document.getElementById("ratio");
const cropframe = document.getElementById("cropframe");

const TIMER_STEPS = [0, 3, 5, 10];
const RATIO_MAP = { full: null, "1:1": 1, "4:3": 4 / 3, "3:4": 3 / 4, "16:9": 16 / 9, "9:16": 9 / 16 };

let stream = null;
let mirrored = false;
let timerSec = 0;
let ratio = null; // null = penuh; selain itu lebar/tinggi
let devices = [];
let currentDeviceId = null;

/* ---------- preferensi tersimpan ---------- */

chrome.storage.local.get(
  ["tgCameraMirror", "tgCameraTimer", "tgCameraDeviceId", "tgCameraRatio"],
  (r) => {
    mirrored = !!(r && r.tgCameraMirror);
    timerSec = (r && r.tgCameraTimer) || 0;
    const ratioKey = (r && r.tgCameraRatio) || "full";
    ratioSel.value = RATIO_MAP[ratioKey] !== undefined ? ratioKey : "full";
    ratio = RATIO_MAP[ratioSel.value];
    applyMirror();
    updateTimerLabel();
    startCamera(r && r.tgCameraDeviceId ? r.tgCameraDeviceId : undefined);
  },
);

/* ---------- rasio ---------- */

ratioSel.addEventListener("change", () => {
  ratio = RATIO_MAP[ratioSel.value];
  chrome.storage.local.set({ tgCameraRatio: ratioSel.value });
  updateCropFrame();
});

// Kotak panduan crop di atas video (memperlihatkan area yang akan diambil).
function updateCropFrame() {
  if (!ratio || !video.videoWidth) {
    cropframe.hidden = true;
    return;
  }
  const elW = video.clientWidth, elH = video.clientHeight;
  const vW = video.videoWidth, vH = video.videoHeight;
  const scale = Math.min(elW / vW, elH / vH);
  const contentW = vW * scale, contentH = vH * scale;
  const lbX = (elW - contentW) / 2, lbY = (elH - contentH) / 2;

  let boxW, boxH;
  if (contentW / contentH > ratio) {
    boxH = contentH;
    boxW = boxH * ratio;
  } else {
    boxW = contentW;
    boxH = boxW / ratio;
  }

  cropframe.hidden = false;
  cropframe.style.left = video.offsetLeft + lbX + (contentW - boxW) / 2 + "px";
  cropframe.style.top = video.offsetTop + lbY + (contentH - boxH) / 2 + "px";
  cropframe.style.width = boxW + "px";
  cropframe.style.height = boxH + "px";
}

window.addEventListener("resize", updateCropFrame);

/* ---------- mirror ---------- */

function applyMirror() {
  video.style.transform = mirrored ? "scaleX(-1)" : "none";
  mirrorBtn.classList.toggle("active", mirrored);
}

mirrorBtn.addEventListener("click", () => {
  mirrored = !mirrored;
  applyMirror();
  chrome.storage.local.set({ tgCameraMirror: mirrored });
});

/* ---------- self-timer ---------- */

function updateTimerLabel() {
  timerBtn.textContent = timerSec ? `⏱ ${timerSec}s` : "⏱ Off";
  timerBtn.classList.toggle("active", timerSec > 0);
}

timerBtn.addEventListener("click", () => {
  const i = TIMER_STEPS.indexOf(timerSec);
  timerSec = TIMER_STEPS[(i + 1) % TIMER_STEPS.length];
  updateTimerLabel();
  chrome.storage.local.set({ tgCameraTimer: timerSec });
});

function runCountdown(sec) {
  return new Promise((resolve) => {
    let n = sec;
    countdown.hidden = false;
    countdown.textContent = n;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        countdown.hidden = true;
        resolve();
      } else {
        countdown.textContent = n;
      }
    }, 1000);
  });
}

/* ---------- kamera ---------- */

function setStatus(msg) {
  if (!msg) {
    status.hidden = true;
  } else {
    status.hidden = false;
    status.textContent = msg;
  }
}

async function startCamera(deviceId) {
  setStatus("Memuat kamera…");
  try {
    const videoConstraint = deviceId ? { deviceId: { exact: deviceId } } : true;
    stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false });
  } catch (err) {
    // Device tersimpan mungkin sudah hilang -> coba kamera default.
    if (deviceId) {
      startCamera(undefined);
      return;
    }
    setStatus("Tidak bisa mengakses kamera: " + err.name + " — " + err.message);
    return;
  }

  const track = stream.getVideoTracks()[0];
  currentDeviceId = (track.getSettings && track.getSettings().deviceId) || deviceId || null;

  video.srcObject = stream;
  video.onloadedmetadata = () => {
    video.play().then(() => setStatus("")).catch((e) => setStatus("Gagal play: " + e.message));
    updateCropFrame();
  };
  video.onplaying = () => { setStatus(""); updateCropFrame(); };
  video.play().then(() => setStatus("")).catch(() => {});

  refreshDevices();
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

// Label device baru tersedia setelah izin kamera diberikan.
async function refreshDevices() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    devices = all.filter((d) => d.kind === "videoinput");
    switchBtn.hidden = devices.length < 2;
  } catch (_) {
    switchBtn.hidden = true;
  }
}

switchBtn.addEventListener("click", () => {
  if (devices.length < 2) return;
  const idx = devices.findIndex((d) => d.deviceId === currentDeviceId);
  const next = devices[(idx + 1) % devices.length];
  chrome.storage.local.set({ tgCameraDeviceId: next.deviceId });
  stopCamera();
  startCamera(next.deviceId);
});

/* ---------- ambil & kirim foto ---------- */

shutterBtn.addEventListener("click", async () => {
  if (!video.videoWidth) {
    setStatus("Kamera belum siap…");
    return;
  }
  shutterBtn.disabled = true;
  switchBtn.disabled = true;
  timerBtn.disabled = true;

  if (timerSec > 0) await runCountdown(timerSec);

  captureAndSend();
});

function captureAndSend() {
  const vW = video.videoWidth, vH = video.videoHeight;

  // Crop tengah sesuai rasio terpilih (atau penuh bila rasio null).
  let sW = vW, sH = vH;
  if (ratio) {
    if (vW / vH > ratio) {
      sH = vH;
      sW = Math.round(sH * ratio);
    } else {
      sW = vW;
      sH = Math.round(sW / ratio);
    }
  }
  const sx = Math.round((vW - sW) / 2);
  const sy = Math.round((vH - sH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = sW;
  canvas.height = sH;
  const ctx = canvas.getContext("2d");
  if (mirrored) {
    // Balik horizontal agar hasil foto sesuai yang terlihat di layar.
    ctx.translate(sW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sW, sH, 0, 0, sW, sH);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

  stopCamera();
  chrome.storage.local.set({ tgCameraPhoto: { dataUrl, ts: Date.now() } }, () => {
    window.close();
  });
}

cancelBtn.addEventListener("click", () => {
  stopCamera();
  window.close();
});

window.addEventListener("beforeunload", stopCamera);
