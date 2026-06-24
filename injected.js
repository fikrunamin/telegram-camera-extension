// Berjalan di MAIN world (konteks JS halaman Telegram), bukan isolated world.
// Tujuannya: men-dispatch event "paste" berisi gambar dari konteks yang SAMA
// dengan handler Telegram, sehingga e.clipboardData (DataTransfer) terlihat
// oleh Telegram. Foto dikirim dari content script via window.postMessage.

(() => {
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
      // webk (/k/)
      document.querySelector(".input-message-input[contenteditable='true']") ||
      document.querySelector(".input-message-input") ||
      // webz (/a/)
      document.querySelector("#editable-message-text") ||
      document.querySelector('[contenteditable="true"]')
    );
  }

  function dispatchPaste(file) {
    const input = findMessageInput();
    if (!input) return false;
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
    return true;
  }

  function dispatchDrop(file) {
    const target =
      // webk (/k/)
      document.querySelector(".chat-input") ||
      document.querySelector(".bubbles") ||
      document.querySelector(".chat") ||
      // webz (/a/)
      document.querySelector("#MiddleColumn") ||
      document.querySelector(".messages-layout") ||
      findMessageInput() ||
      document.body;

    const dt = new DataTransfer();
    dt.items.add(file);

    for (const type of ["dragenter", "dragover", "drop"]) {
      const ev = new DragEvent(type, { bubbles: true, cancelable: true, composed: true });
      Object.defineProperty(ev, "dataTransfer", { value: dt });
      target.dispatchEvent(ev);
    }
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
})();
