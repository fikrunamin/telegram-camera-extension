// Halaman kamera milik extension (chrome-extension://). Bebas dari batasan
// halaman Telegram. Ambil foto -> preview -> kirim dataURL ke window pembuka
// (tab Telegram) lalu tutup.

const LOG = (...a) => console.log("%c[TG-CAM-PAGE]", "color:#3390ec;font-weight:bold", ...a);

const video = document.getElementById("video");
const preview = document.getElementById("preview");
const status = document.getElementById("status");

const shutterBtn = document.getElementById("shutter");
const cancelBtn = document.getElementById("cancel");
const retakeBtn = document.getElementById("retake");
const useBtn = document.getElementById("use");

let stream = null;
let capturedDataUrl = null;

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
    LOG("getUserMedia gagal:", err.name, err.message);
    setStatus("Tidak bisa mengakses kamera: " + err.name + " — " + err.message);
    return;
  }

  const track = stream.getVideoTracks()[0];
  LOG("kamera:", track && track.label, "| readyState:", track && track.readyState);

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
  retakeBtn.hidden = true;
  useBtn.hidden = true;
}

function showPreviewMode(dataUrl) {
  preview.src = dataUrl;
  preview.hidden = false;
  video.hidden = true;
  shutterBtn.hidden = true;
  cancelBtn.hidden = true;
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
  canvas.getContext("2d").drawImage(video, 0, 0);
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
  if (window.opener) {
    window.opener.postMessage({ type: "TG_CAMERA_PHOTO", dataUrl: capturedDataUrl }, "*");
  } else {
    setStatus("Tidak menemukan tab Telegram pembuka.");
    return;
  }
  window.close();
});

window.addEventListener("beforeunload", stopCamera);

showCameraMode();
startCamera();
