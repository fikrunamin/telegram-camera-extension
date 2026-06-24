# Telegram Camera

Chrome extension untuk **Telegram Web (`/k/`)** yang menambahkan tombol **Camera** ke menu attachment (paperclip). Ambil foto langsung dari webcam, lihat **preview** sebelum kirim, lalu foto masuk ke **dialog kirim-media native Telegram** (lengkap dengan caption) — persis seperti upload gambar biasa.

## Fitur

- 📎 Item **Camera** menyatu di menu attachment Telegram (tahan bahasa apa pun — deteksi via ikon, bukan teks).
- 📷 Popup kamera dengan tombol **shutter**, **preview**, dan opsi **Ulangi / Gunakan**.
- 🪞 Toggle **mirror** (cermin) — preferensi tersimpan antar sesi.
- 🚀 Foto dikirim lewat **paste di main world** sehingga muncul dialog kirim native Telegram.

## Instalasi (mode developer)

1. Buka `chrome://extensions`.
2. Aktifkan **Developer mode** (pojok kanan atas).
3. Klik **Load unpacked** → pilih folder repo ini.
4. Buka [`web.telegram.org/k/`](https://web.telegram.org/k/) dan **refresh**.
5. Saat pertama memakai kamera, izinkan akses kamera untuk jendela popup extension.

> Setiap kali mengubah kode, klik **reload (↻)** pada extension di `chrome://extensions`, lalu refresh tab Telegram.

## Cara pakai

1. Buka sebuah chat.
2. Klik ikon **paperclip** → pilih **Camera**.
3. Di popup kamera, tekan tombol bundar untuk mengambil foto.
4. (Opsional) aktifkan **mirror** (`⇋`) sebelum mengambil foto.
5. Tinjau hasilnya → **Ulangi** untuk foto ulang, atau **Gunakan**.
6. Dialog kirim foto native Telegram muncul → tambahkan caption → kirim.

## Cara kerja

```
[Menu attachment Telegram]
        │  klik "Camera"  (content.js — isolated world)
        ▼
[Popup camera.html]  ── getUserMedia → preview → "Gunakan"
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
| `content.js` | isolated world | Sisipkan item Camera, buka popup, teruskan foto ke main world. |
| `camera.html` / `camera-page.js` / `camera-page.css` | extension page | UI kamera (popup): capture, preview, mirror. |
| `injected.js` | **main world** | Dispatch event paste agar dialog kirim Telegram muncul. |
| `styles.css` | isolated world | Styling item menu Camera. |
| `icons/` | — | Ikon extension & item menu. |

## Batasan

- Hanya untuk Telegram Web versi **`/k/`** (selector menyesuaikan webk). Versi `/a/` belum didukung.
- Membutuhkan izin kamera dari browser/OS.
- Pastikan tidak ada aplikasi lain yang sedang memakai kamera.
