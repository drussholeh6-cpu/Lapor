# 🏛️ Lacak Aduan — Sistem Pengaduan Publik Kota Lowokwaru

**Lacak Aduan** adalah aplikasi web pengaduan publik (civic-tech) untuk Pemerintah Kota Lowokwaru. Warga dapat mengirim laporan tanpa perlu membuat akun, lalu memantau tindak lanjut menggunakan nomor aduan secara transparan. Petugas dan admin mengelola laporan melalui ruang kerja internal dengan fitur dashboard, notifikasi, dan laporan yang lengkap.

> **Live Demo:** [https://aduan.badrussholeh.my.id](https://aduan.badrussholeh.my.id)

---

## 📋 Deskripsi Singkat

Lacak Aduan dirancang sebagai platform pengaduan masyarakat yang **mudah digunakan**, **transparan**, dan **akuntabel**. Sistem ini memungkinkan:

- **Warga** mengirim aduan tanpa registrasi, melacak status secara real-time, serta melihat statistik pelayanan publik.
- **Petugas** menangani aduan sesuai unitnya dengan dashboard, grafik tren, dan notifikasi otomatis.
- **Admin** mengelola seluruh aduan, akun petugas, serta memantau kinerja penanganan.

---

## 🛠️ Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| **Backend** | Node.js 20+, Express.js |
| **Database** | Supabase (PostgreSQL, Auth, Storage) |
| **Frontend** | HTML5, CSS3, JavaScript (Vanilla) |
| **Peta** | Leaflet.js |
| **Email** | Brevo (HTTPS API, email transaksional) |
| **Ekspor Laporan** | ExcelJS (.xlsx) |
| **PWA** | Service Worker, Web App Manifest |
| **Keamanan** | Helmet, Rate Limiter, Cookie httpOnly, Challenge Anti-Bot |
| **Deployment** | Vercel (Serverless Node.js) |

---

## 🚀 Cara Menjalankan Project

### Persyaratan

- **Node.js** 20 atau lebih baru
- **npm**
- **Project Supabase** dengan kredensial yang sesuai

### 1. Clone Repository

```bash
git clone https://github.com/drussholeh6-cpu/Lapor.git
cd Lapor
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Konfigurasi Environment

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

> ⚠️ **Jangan masukkan kredensial asli ke Git.** `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di backend dan harus dirahasiakan.

### 4. Siapkan Database

Jalankan `database/supabase.sql` melalui **SQL Editor Supabase** untuk membuat skema tabel dan bucket storage.

### 5. Jalankan Server

```bash
# Development (watch mode)
npm run dev

# Production
npm start
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### 6. Jalankan Tes

```bash
node --test
```

---

## 📜 Perintah npm

| Perintah | Kegunaan |
|----------|----------|
| `npm start` | Menjalankan server |
| `npm run dev` | Menjalankan server dengan watch mode |
| `npm run test:api` | Pemeriksaan API dasar pada server lokal |
| `npm run staff:claims` | Utilitas klaim petugas |
| `npm run migrate:firebase` | Migrasi data dari Firebase ke Supabase |

---

## ✅ Progress Saat Ini

### Fitur Warga (Publik)
- [x] Kirim aduan tanpa registrasi (email, kategori, lokasi, prioritas, deskripsi)
- [x] Pilih titik lokasi di peta atau gunakan GPS perangkat
- [x] Upload foto bukti (termasuk HEIC) dengan kompresi otomatis
- [x] Nomor aduan dan konfirmasi email otomatis
- [x] Lacak aduan real-time dengan nomor aduan
- [x] Papan pemantauan publik — daftar aduan terbuka
- [x] Statistik publik: tren bulanan, rata-rata penyelesaian, ranking unit tercepat
- [x] Peta kepadatan aduan (density map) — tampil mulai 1 aduan
- [x] Notifikasi email saat status aduan berubah
- [x] Challenge anti-bot (matematika) sebelum submit
- [x] PWA — installable, offline support, push notification-ready

### Fitur Petugas & Admin
- [x] Login petugas dengan email & sandi (dikelola admin, tanpa registrasi publik)
- [x] Dashboard ringkasan: aduan aktif, terlambat, prioritas tinggi, rata-rata selesai
- [x] Grafik tren pengaduan per tanggal/bulan/tahun dengan filter rentang waktu
- [x] Default tampilan: 12 hari terakhir dengan timezone lokal (WIB)
- [x] Notifikasi dashboard aduan baru (polling 15 detik + visibility change)
- [x] Filter aduan per status & prioritas
- [x] Ubah status, prioritas, unit, dan catatan tindak lanjut (publik/internal)
- [x] Tolak aduan dengan alasan wajib
- [x] Upload bukti foto pada tindak lanjut
- [x] Ekspor laporan ke Excel (.xlsx) dengan filter
- [x] Admin: kelola akun petugas (daftar, edit, hapus)
- [x] Admin: hapus aduan massal
- [x] Riwayat aktivitas & perubahan aduan

### UI/UX
- [x] Government-Tech Design System (Slate · Blue · Accessible)
- [x] Responsive layout (desktop, tablet, mobile)
- [x] Dark mode (sistem/manual)
- [x] Custom logo HD 512×512 dengan squircle mask
- [x] Badge notifikasi center-aligned
- [x] Show/hide password toggle

### Privasi & Keamanan
- [x] Data identitas pelapor tidak ditampilkan di papan publik
- [x] Statistik wilayah menggunakan area agregat (bukan alamat pelapor)
- [x] Catatan internal hanya untuk petugas
- [x] Autentikasi cookie httpOnly + sesi server
- [x] Rate limiting, Helmet, CORS
- [x] Challenge anti-bot matematika

### Yang Akan Datang
- [ ] Rating/feedback dari warga setelah aduan selesai
- [ ] Push notification (FCM/Web Push)
- [ ] Analitik lanjutan di dashboard admin

---

## 📁 Struktur Kode

```
Lapor/
├── public/            # Frontend: HTML, CSS, JavaScript, icons, PWA
├── routes/            # Definisi routing API
├── controllers/       # Handler request
├── services/          # Logika bisnis, statistik, email, laporan
├── models/            # Akses data Supabase
├── middleware/         # Auth, otorisasi, anti-bot challenge
├── config/            # Konfigurasi Supabase
├── core/              # Inisialisasi Express, middleware umum, error handler
├── database/          # supabase.sql — skema database & bucket
├── scripts/           # Utilitas admin, migrasi, pemeriksaan API
├── tests/             # Unit test (statistik publik, email service)
├── api/               # Entry point Vercel serverless
├── .env.example       # Template konfigurasi environment
├── vercel.json        # Konfigurasi deployment Vercel
├── package.json       # Dependencies & npm scripts
├── server.js          # Entry point server
└── app.js             # Setup Express app
```

---

## 🚀 Deployment

Konfigurasi `vercel.json` mengarahkan semua request ke server Node.js. Atur variabel environment dari `.env.example` pada platform deployment. Pastikan URL production menggunakan HTTPS dan sesuai dengan `PUBLIC_APP_URL`.

---

## 🔒 Privasi

Informasi identitas pelapor tidak ditampilkan pada papan publik maupun statistik. Statistik wilayah menggunakan area agregat, bukan alamat pelapor. Catatan internal dan bukti internal hanya ditujukan untuk petugas.

---

## 📝 Endpoint API

Semua endpoint diawali `/api`. Endpoint yang memerlukan sesi memakai autentikasi petugas berbasis cookie.

### Publik

| Metode | Endpoint | Keterangan |
|--------|----------|------------|
| `GET` | `/api/health` | Status aplikasi & cek koneksi DB |
| `GET` | `/api/statistics` | Statistik publik |
| `GET` | `/api/complaints` | Daftar aduan papan publik |
| `GET` | `/api/complaints/:code` | Detail publik aduan |
| `GET` | `/api/challenge` | Challenge anti-bot |
| `POST` | `/api/complaints` | Kirim aduan |
| `POST` | `/api/complaints/:code/confirmation` | Kirim ulang konfirmasi |
| `POST` | `/api/complaints/:code/replies` | Balas permintaan informasi |

### Autentikasi

| Metode | Endpoint | Akses |
|--------|----------|-------|
| `POST` | `/api/auth/login` | Petugas/Admin |
| `GET` | `/api/auth/me` | Sesi aktif |
| `POST` | `/api/auth/logout` | Keluar |
| `GET` | `/api/auth/staffs` | Admin |
| `POST` | `/api/auth/staffs/register` | Admin |
| `PATCH` | `/api/auth/staffs` | Admin |
| `DELETE` | `/api/auth/staffs` | Admin |

### Ruang Kerja Petugas

| Metode | Endpoint | Akses |
|--------|----------|-------|
| `GET` | `/api/staff/complaints` | Petugas/Admin |
| `GET` | `/api/staff/complaints/:code` | Petugas/Admin |
| `PATCH` | `/api/staff/complaints/:code` | Petugas/Admin |
| `GET` | `/api/staff/complaints/report.xlsx` | Petugas/Admin |
| `DELETE` | `/api/staff/complaints` | Admin |

---

## 📄 Lisensi

Project ini dikembangkan untuk keperluan demo dan lomba inovasi pelayanan publik Kota Lowokwaru.
