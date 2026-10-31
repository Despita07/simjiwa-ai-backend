# SIMJIWA — Paket perbaikan integrasi Jiwa-AI

## Yang sudah disesuaikan
- `index.html` asli dipertahankan; materi, simulasi, Ruang 3D/WebXR, dan Refleksi tidak dihapus.
- Jiwa-AI diarahkan ke URL backend yang dapat dikonfigurasi melalui `SIMJIWA_API_BASE`.
- Backend menyediakan `GET /api/health` dan `POST /api/feedback`, sesuai endpoint yang dipanggil frontend.

## 1. Perbarui GitHub Pages
1. Cadangkan repository lama.
2. Ganti `index.html` pada root repository `Despita07/simjiwa-prototipe` dengan file `index.html` dari paket ini.
3. Commit perubahan. GitHub Pages tetap menjalankan file statis.

## 2. Buat backend di Render
1. Buat repository GitHub terpisah, misalnya `simjiwa-ai-backend`.
2. Unggah isi folder `backend` dari paket ini ke root repository backend (server.js dan package.json).
3. Di Render pilih New > Web Service dan hubungkan repository itu.
4. Build Command: `npm install`; Start Command: `npm start`; gunakan Node.js 20+.
5. Tambahkan Environment Variables:
   - `OPENAI_API_KEY`: API key OpenAI Platform Anda.
   - `OPENAI_MODEL`: `gpt-4.1-mini` (opsional; pastikan model tersedia pada akun API).
   - `ALLOWED_ORIGIN`: `https://despita07.github.io`
6. Deploy, lalu salin URL HTTPS service Render.

## 3. Hubungkan halaman dengan backend
1. Pada `index.html` di GitHub, cari `SIMJIWA_API_BASE`.
2. Ganti `https://GANTI-DENGAN-URL-RENDER-ANDA` dengan URL Render, tanpa garis miring di akhir.
3. Commit lagi perubahan tersebut.

## 4. Tes
1. Buka `https://URL-RENDER-ANDA/api/health`.
2. Harus terlihat `ok:true`, `aiEnabled:true`, `mode:"generative-ai"`.
3. Buka GitHub Pages, menu Jiwa-AI, kirim respons pada skenario latihan.
4. Pastikan badge menjadi `Generative AI aktif` dan gelembung respons bertuliskan `Jiwa-AI · Generative AI`.

## Keamanan
- Jangan pernah memasukkan API key ke HTML, GitHub, atau chat. Simpan hanya pada Environment Variables Render.
- Pakai skenario fiktif. Jangan masukkan identitas atau data pasien nyata.
- Jiwa-AI hanya untuk umpan balik pendidikan, bukan diagnosis atau keputusan klinis.
- Jika backend belum dikonfigurasi, halaman tetap menggunakan demo lokal.
