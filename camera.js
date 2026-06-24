// Alur kamera (overlay di dalam halaman Telegram):
// buka stream -> viewfinder -> capture -> preview -> kirim ke Telegram lewat
// paste sintetis (muncul dialog preview/caption native Telegram).

let activeStream = null;

const LOG = (...a) => console.log("%c[TG-CAM]", "color:#3390ec;font-weight:bold", ...a);

async function openTelegramCamera() {
  LOG("openTelegramCamera() dipanggil | secureContext:", window.isSecureContext);

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Halaman ini tidak mengizinkan akses kamera (mediaDevices tidak tersedia).");
    return;
  }

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    LOG("getUserMedia OK:", activeStream.getVideoTracks().map((t) => ({
      label: t.label, readyState: t.readyState,
    })));
  } catch (err) {
    LOG("getUserMedia GAGAL:", err.name, err.message);
    alert("Tidak bisa mengakses kamera: " + err.name + " — " + err.message);
    return;
  }

  showCamera(activeStream);
}

function stopStream() {
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop());
    activeStream = null;
  }
}

function closeOverlay() {
  stopStream();
  const overlay = document.getElementById("tg-camera-overlay");
  if (overlay) overlay.remove();
}

// Viewfinder + tombol shutter.
function showCamera(stream) {
  closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "tg-camera-overlay";
  overlay.className = "tg-camera-overlay";
  overlay.innerHTML = `
    <div class="tg-camera-stage">
      <video class="tg-camera-video" autoplay playsinline muted></video>
      <div class="tg-camera-status">Memuat kamera…</div>
    </div>
    <div class="tg-camera-controls">
      <button class="tg-camera-cancel" type="button">Batal</button>
      <button class="tg-camera-shutter" type="button" aria-label="Ambil foto"></button>
      <span class="tg-camera-spacer"></span>
    </div>
  `;
  document.body.appendChild(overlay);

  const video = overlay.querySelector(".tg-camera-video");
  const status = overlay.querySelector(".tg-camera-status");

  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.srcObject = stream;
  video.onloadedmetadata = () => {
    video.play().then(() => { status.style.display = "none"; })
      .catch((e) => { status.textContent = "Gagal memutar video: " + e.message; });
  };
  video.play().then(() => { status.style.display = "none"; }).catch(() => {});

  overlay.querySelector(".tg-camera-cancel").addEventListener("click", closeOverlay);
  overlay.querySelector(".tg-camera-shutter").addEventListener("click", () => capture(video));
}

function capture(video) {
  if (!video.videoWidth) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  canvas.toBlob(
    (blob) => {
      stopStream();
      showPreview(blob);
    },
    "image/jpeg",
    0.95,
  );
}

// Preview hasil foto dengan opsi "Ulangi" atau "Gunakan".
function showPreview(blob) {
  const url = URL.createObjectURL(blob);
  const overlay = document.getElementById("tg-camera-overlay");
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="tg-camera-stage">
      <img class="tg-camera-preview" src="${url}" alt="">
    </div>
    <div class="tg-camera-controls">
      <button class="tg-camera-retake" type="button">Ulangi</button>
      <button class="tg-camera-use" type="button">Gunakan</button>
    </div>
  `;

  overlay.querySelector(".tg-camera-retake").addEventListener("click", () => {
    URL.revokeObjectURL(url);
    openTelegramCamera();
  });

  overlay.querySelector(".tg-camera-use").addEventListener("click", () => {
    URL.revokeObjectURL(url);
    sendToTelegram(blob);
    closeOverlay();
  });
}

// Menyuntikkan foto ke Telegram lewat event paste sintetis.
function sendToTelegram(blob) {
  const file = new File([blob], `photo_${stamp()}.jpg`, { type: "image/jpeg" });

  const dt = new DataTransfer();
  dt.items.add(file);

  const input =
    document.querySelector(".input-message-input[contenteditable='true']") ||
    document.querySelector(".input-message-input") ||
    document.querySelector('[contenteditable="true"]');

  if (!input) {
    alert("Tidak menemukan kolom pesan Telegram. Buka sebuah chat dulu.");
    return;
  }

  input.focus();

  const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(pasteEvent, "clipboardData", { value: dt });
  input.dispatchEvent(pasteEvent);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
