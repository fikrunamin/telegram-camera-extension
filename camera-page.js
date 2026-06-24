// Halaman kamera milik extension (chrome-extension://). Bebas dari batasan
// halaman Telegram. Ambil foto -> preview -> kirim dataURL ke window pembuka
// (tab Telegram) lalu tutup.

const video = document.getElementById("video");
const preview = document.getElementById("preview");
const status = document.getElementById("status");

const shutterBtn = document.getElementById("shutter");
const cancelBtn = document.getElementById("cancel");
const retakeBtn = document.getElementById("retake");
const useBtn = document.getElementById("use");
const mirrorBtn = document.getElementById("mirror");

let stream = null;
let capturedDataUrl = null;
let mirrored = false;

function applyMirror() {
  video.style.transform = mirrored ? "scaleX(-1)" : "none";
  mirrorBtn.classList.toggle("active", mirrored);
}

// Ingat preferensi mirror antar sesi.
chrome.storage.local.get("tgCameraMirror", (r) => {
  mirrored = !!(r && r.tgCameraMirror);
  applyMirror();
});

mirrorBtn.addEventListener("click", () => {
  mirrored = !mirrored;
  applyMirror();
  chrome.storage.local.set({ tgCameraMirror: mirrored });
});

function setStatus(msg) {
  if (!msg) {
    status.hidden = true;
  } else {
    status.hidden = false;
    status.textContent = msg;
  }
}

async function startCamera() {
  setStatus("Memuat kamera…");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (err) {
    setStatus("Tidak bisa mengakses kamera: " + err.name + " — " + err.message);
    return;
  }

  video.srcObject = stream;
  video.onloadedmetadata = () => {
    video.play().then(() => setStatus("")).catch((e) => setStatus("Gagal play: " + e.message));
  };
  video.play().then(() => setStatus("")).catch(() => {});
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

function showCameraMode() {
  preview.hidden = true;
  video.hidden = false;
  shutterBtn.hidden = false;
  cancelBtn.hidden = false;
  mirrorBtn.hidden = false;
  retakeBtn.hidden = true;
  useBtn.hidden = true;
}

function showPreviewMode(dataUrl) {
  preview.src = dataUrl;
  preview.hidden = false;
  video.hidden = true;
  shutterBtn.hidden = true;
  cancelBtn.hidden = true;
  mirrorBtn.hidden = true;
  retakeBtn.hidden = false;
  useBtn.hidden = false;
}

shutterBtn.addEventListener("click", () => {
  if (!video.videoWidth) {
    setStatus("Kamera belum siap…");
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (mirrored) {
    // Balik horizontal agar hasil foto sesuai dengan yang terlihat di layar.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0);
  capturedDataUrl = canvas.toDataURL("image/jpeg", 0.95);
  stopCamera();
  showPreviewMode(capturedDataUrl);
});

cancelBtn.addEventListener("click", () => {
  stopCamera();
  window.close();
});

retakeBtn.addEventListener("click", () => {
  capturedDataUrl = null;
  showCameraMode();
  startCamera();
});

useBtn.addEventListener("click", () => {
  if (!capturedDataUrl) return;
  // Kirim lewat chrome.storage (andal lintas-konteks; tidak bergantung opener).
  chrome.storage.local.set(
    { tgCameraPhoto: { dataUrl: capturedDataUrl, ts: Date.now() } },
    () => {
      stopCamera();
      window.close();
    },
  );
});

window.addEventListener("beforeunload", stopCamera);

showCameraMode();
startCamera();
