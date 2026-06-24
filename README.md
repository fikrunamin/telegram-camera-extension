# Telegram Camera

Chrome extension untuk **Telegram Web (`/k/` & `/a/`)** yang menambahkan tombol **Camera** ke menu attachment (paperclip). Ambil foto langsung dari webcam, lalu foto masuk ke **dialog kirim-media native Telegram** (lengkap dengan preview & caption) — persis seperti upload gambar biasa.

## Fitur

- 📎 Item **Camera** menyatu di menu attachment Telegram (tahan bahasa apa pun — deteksi via ikon, bukan teks).
- 🟢 Mendukung **kedua versi** Telegram Web: **`/k/` (webk)** dan **`/a/` (webz)**.
- 📷 Popup kamera dengan tombol **shutter** — sekali tekan langsung kirim (tanpa langkah preview di popup).
- 🔄 **Ganti kamera** (depan/belakang / multi-device) — preferensi tersimpan.
- ⏱ **Self-timer**: Off → 3s → 5s → 10s, dengan hitung mundur di layar.
- 🖼 **Rasio**: Penuh / 1:1 / 4:3 / 3:4 / 16:9 / 9:16, dengan kotak panduan crop.
- 🪞 Toggle **mirror** (cermin).
- 🚀 Foto dikirim lewat **paste di main world** sehingga muncul **dialog kirim native Telegram** (tempat preview & caption).

> Semua preferensi (kamera, timer, rasio, mirror) disimpan di `chrome.storage` dan diingat antar sesi.

## Instalasi (mode developer)

1. Buka `chrome://extensions`.
2. Aktifkan **Developer mode** (pojok kanan atas).
3. Klik **Load unpacked** → pilih folder repo ini.
4. Buka [`web.telegram.org/k/`](https://web.telegram.org/k/) atau [`/a/`](https://web.telegram.org/a/) dan **refresh**.
5. Saat pertama memakai kamera, izinkan akses kamera untuk jendela popup extension.

> Setiap kali mengubah kode, klik **reload (↻)** pada extension di `chrome://extensions`, lalu refresh tab Telegram.

## Cara pakai

1. Buka sebuah chat.
2. Klik ikon **paperclip** → pilih **Camera**.
3. (Opsional) atur **kamera** (🔄), **timer** (⏱), **rasio**, atau **mirror** (`⇋`) di popup.
4. Tekan tombol bundar (shutter) — foto langsung dikirim ke Telegram (setelah hitung mundur bila timer aktif).
5. Dialog kirim foto native Telegram muncul (preview + caption) → kirim.

## Cara kerja

```
[Menu attachment Telegram]
        │  klik "Camera"  (content.js — isolated world)
        ▼
[Popup camera.html]  ── getUserMedia → shutter
        │  simpan foto (dataURL) ke chrome.storage.local
        ▼
[content.js]  ── chrome.storage.onChanged → window.postMessage
        │
        ▼
[injected.js — MAIN world]  ── dispatch event "paste" berisi File
        ▼
[Dialog kirim-media native Telegram]
```

Detail penting: Telegram membaca `clipboardData` di **konteks JS halaman (main world)**, sedangkan content script extension berjalan di **isolated world**. Maka event paste harus di-dispatch dari main world (`injected.js`, `"world": "MAIN"`) agar datanya terbaca Telegram.

## Struktur file

| File | Konteks | Peran |
|------|---------|-------|
| `manifest.json` | — | Konfigurasi extension (MV3). |
| `content.js` | isolated world | Sisipkan item Camera (webk & webz), buka popup, teruskan foto ke main world. |
| `camera.html` / `camera-page.js` / `camera-page.css` | extension page | UI kamera (popup): capture, ganti kamera, timer, rasio, mirror. |
| `injected.js` | **main world** | Dispatch event paste agar dialog kirim Telegram muncul. |
| `styles.css` | isolated world | Styling item menu Camera (webk & webz). |
| `icons/` | — | Ikon extension & item menu. |

## Batasan

- Mendukung Telegram Web **`/k/`** dan **`/a/`**. Selector menyesuaikan DOM masing-masing; jika Telegram mengubah struktur DOM, selector mungkin perlu diperbarui.
- Membutuhkan izin kamera dari browser/OS.
- Pastikan tidak ada aplikasi lain yang sedang memakai kamera.
