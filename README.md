# Lacak Aduan

Lacak Aduan adalah aplikasi web pengaduan publik untuk Kota Lowokwaru. Warga dapat mengirim laporan tanpa membuat akun, lalu memantau tindak lanjut menggunakan nomor aduan. Petugas mengelola laporan melalui ruang kerja internal; admin juga dapat mengelola akun petugas.

## Fitur

### Untuk warga

- Mengirim aduan dengan email wajib, nama opsional, kategori, lokasi, tingkat prioritas, dan deskripsi.
- Memilih titik lokasi pada peta atau menggunakan lokasi perangkat. Koordinat yang disimpan dibulatkan.
- Menambahkan foto bukti; gambar dikompres dan disimpan pada Supabase Storage.
- Mendapat nomor aduan dan konfirmasi melalui email jika layanan email dikonfigurasi.
- Melacak aduan, membaca status dan catatan yang ditujukan untuk warga, serta melihat riwayat tindak lanjut.
- Memberi penilaian setelah aduan ditutup.
- Melihat papan pemantauan, sebaran lokasi, serta statistik publik yang disinkronkan setiap 15 detik; peta statistik hanya menampilkan area agregat dengan sedikitnya tiga aduan.

### Untuk petugas dan admin

- Masuk menggunakan akun yang dibuat oleh admin; pendaftaran publik tidak tersedia.
- Petugas melihat dan menangani aduan sesuai unitnya. Admin dapat mengakses seluruh aduan.
- Memfilter aduan menurut status dan prioritas, mengubah prioritas/unit/status, menyertakan alasan saat menolak aduan, dan mencatat tindak lanjut dengan bukti foto.
- Memilih visibilitas catatan dan bukti tindak lanjut: publik atau internal.
- Memantau ringkasan, tren laporan per tanggal/bulan/tahun dengan filter rentang tanggal. Grafik menampilkan 30 hari, 12 bulan, atau 5 tahun terakhir secara default.
- Menerima notifikasi dashboard saat aduan baru masuk; daftar aduan diperiksa tiap 15 detik dan saat dashboard kembali aktif.
- Admin dapat mengelola akun petugas dan menghapus aduan.

## Alur status

Alur penanganan terdiri dari aduan diterima, diverifikasi, diproses, lalu selesai atau ditolak. Status dan catatan publik dapat dilihat warga saat melacak. Catatan internal hanya tersedia bagi petugas. Penolakan harus disertai alasan.

## Teknologi

- Node.js 20 atau lebih baru dan Express
- Supabase PostgreSQL, Auth, dan Storage
- Brevo untuk pengiriman email transaksional
- Leaflet untuk peta
- ExcelJS untuk ekspor laporan
- HTML, CSS, dan JavaScript untuk antarmuka web

## Menjalankan secara lokal

### Persyaratan

- Node.js 20+
- npm
- Project Supabase dengan kredensial yang sesuai

### Instalasi

```bash
git clone https://github.com/drussholeh6-cpu/Lapor.git
cd Lapor
npm install
```

Salin `.env.example` menjadi `.env`, lalu isi konfigurasi yang diperlukan:

```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BREVO_API_KEY=your-brevo-api-key
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=Lacak Aduan
PUBLIC_APP_URL=http://localhost:3000
CHALLENGE_SECRET=generate-a-long-random-secret
```

Jangan masukkan kredensial asli ke Git. `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di backend dan harus dirahasiakan. `CHALLENGE_SECRET` digunakan untuk menandatangani tantangan matematika anti-bot. Email memerlukan `BREVO_API_KEY`, `SMTP_FROM_EMAIL`, dan `PUBLIC_APP_URL`; URL publik di production harus menggunakan HTTPS.

Siapkan skema dan bucket Supabase dengan menjalankan `database/supabase.sql` melalui SQL Editor Supabase. Kemudian jalankan:

```bash
npm run dev
```

Buka <http://localhost:3000>. Untuk menjalankan tanpa watch mode, gunakan `npm start`.

## Perintah npm

| Perintah | Kegunaan |
| --- | --- |
| `npm start` | Menjalankan server |
| `npm run dev` | Menjalankan server dengan Node watch mode |
| `npm run test:api` | Menjalankan pemeriksaan API dasar pada server lokal |
| `npm run staff:claims` | Menjalankan utilitas klaim petugas |
| `npm run migrate:firebase` | Menjalankan utilitas migrasi Firebase ke Supabase |

Tes otomatis yang tersedia dapat dijalankan dengan:

```bash
node --test
```

## Endpoint API

Semua endpoint backend diawali `/api`. Endpoint yang memerlukan sesi memakai autentikasi petugas berbasis cookie.

### Kesehatan dan statistik publik

| Metode | Endpoint | Keterangan |
| --- | --- | --- |
| `GET` | `/api/health` | Status aplikasi dan pemeriksaan koneksi database |
| `GET` | `/api/statistics` | Statistik publik |
| `GET` | `/api/complaints` | Daftar aduan untuk papan publik |
| `GET` | `/api/complaints/:code` | Detail publik aduan berdasarkan nomor |
| `GET` | `/api/challenge` | Tantangan matematika anti-bot |

### Pengiriman dan interaksi warga

| Metode | Endpoint | Keterangan |
| --- | --- | --- |
| `POST` | `/api/complaints` | Mengirim aduan |
| `POST` | `/api/complaints/:code/confirmation` | Mengirim ulang konfirmasi |
| `POST` | `/api/complaints/:code/replies` | Membalas permintaan informasi |
| `POST` | `/api/complaints/:code/ratings` | Memberi penilaian |

### Autentikasi dan pengelolaan akun

| Metode | Endpoint | Akses |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Petugas/admin |
| `GET` | `/api/auth/me` | Sesi petugas/admin |
| `POST` | `/api/auth/logout` | Keluar dari sesi |
| `GET` | `/api/auth/staffs` | Admin |
| `POST` | `/api/auth/staffs/register` | Admin |
| `PATCH` | `/api/auth/staffs` | Admin |
| `DELETE` | `/api/auth/staffs` | Admin |

### Ruang kerja petugas

| Metode | Endpoint | Akses |
| --- | --- | --- |
| `GET` | `/api/staff/complaints` | Petugas/admin |
| `GET` | `/api/staff/complaints/:code` | Petugas/admin |
| `PATCH` | `/api/staff/complaints/:code` | Petugas/admin |
| `GET` | `/api/staff/complaints/report.xlsx` | Petugas/admin |
| `DELETE` | `/api/staff/complaints` | Admin |

## Struktur kode

- `public/` — halaman web, stylesheet, dan JavaScript frontend
- `routes/`, `controllers/` — routing API dan penanganan request
- `services/`, `models/` — logika bisnis, statistik, email, laporan, dan akses data
- `middleware/` — autentikasi, otorisasi, dan tantangan anti-bot
- `config/` — konfigurasi Supabase
- `core/` — inisialisasi Express, middleware umum, dan penanganan error
- `database/supabase.sql` — skema database dan konfigurasi bucket bukti
- `scripts/` — utilitas administrasi, migrasi, dan pemeriksaan API
- `tests/` — tes statistik publik dan layanan email

## Deployment

Konfigurasi `vercel.json` mengarahkan request ke server Node.js. Atur variabel environment dari `.env.example` pada platform deployment; jangan mengunggah file `.env`. Pastikan URL aplikasi production menggunakan HTTPS dan sesuai dengan `PUBLIC_APP_URL` agar tautan email mengarah ke situs yang benar.

## Privasi

Informasi identitas pelapor tidak ditampilkan pada papan publik maupun statistik publik. Statistik wilayah menggunakan area agregat, bukan alamat pelapor. Catatan internal dan bukti internal hanya ditujukan untuk petugas.
