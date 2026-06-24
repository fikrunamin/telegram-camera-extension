// Berjalan di MAIN world (konteks JS halaman Telegram), bukan isolated world.
// Tujuannya: men-dispatch event "paste" berisi gambar dari konteks yang SAMA
// dengan handler Telegram, sehingga e.clipboardData (DataTransfer) terlihat
// oleh Telegram. Foto dikirim dari content script via window.postMessage.

(() => {
  const LOG = (...a) => console.log("%c[TG-CAM-INJ]", "color:#e67e22;font-weight:bold", ...a);

  function dataUrlToFile(dataUrl, name) {
    const [head, b64] = dataUrl.split(",");
    const mime = head.match(/:(.*?);/)[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([new Blob([arr], { type: mime })], name, { type: mime });
  }

  function findMessageInput() {
    return (
      document.querySelector(".input-message-input[contenteditable='true']") ||
      document.querySelector(".input-message-input") ||
      document.querySelector('[contenteditable="true"]')
    );
  }

  function dispatchPaste(file) {
    const input = findMessageInput();
    if (!input) {
      LOG("kolom pesan tidak ditemukan — buka chat dulu");
      return false;
    }
    input.focus();

    const dt = new DataTransfer();
    dt.items.add(file);

    const ev = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    try {
      Object.defineProperty(ev, "clipboardData", { value: dt });
    } catch (_) {
      /* sebagian browser sudah mengisi clipboardData dari constructor */
    }
    input.dispatchEvent(ev);
    LOG("foto dikirim ke Telegram via paste |", file.type, file.size, "bytes");
    return true;
  }

  function dispatchDrop(file) {
    const target =
      document.querySelector(".chat-input") ||
      document.querySelector(".bubbles") ||
      document.querySelector(".chat") ||
      findMessageInput() ||
      document.body;

    const dt = new DataTransfer();
    dt.items.add(file);

    for (const type of ["dragenter", "dragover", "drop"]) {
      const ev = new DragEvent(type, { bubbles: true, cancelable: true, composed: true });
      Object.defineProperty(ev, "dataTransfer", { value: dt });
      target.dispatchEvent(ev);
    }
    LOG("drop dikirim ke", target.className || target.tagName);
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__tgCam !== "send-image" || !d.dataUrl) return;

    const file = dataUrlToFile(d.dataUrl, d.name || "photo.jpg");

    // Utama: paste (sesuai mekanisme Telegram). Kalau kolom pesan tak ada,
    // coba drop sebagai cadangan.
    if (!dispatchPaste(file)) {
      dispatchDrop(file);
    }
  });

  LOG("aktif di main world");
})();
