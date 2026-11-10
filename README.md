# Lacak Aduan

Lacak Aduan adalah aplikasi web pelaporan masyarakat yang memungkinkan warga mengirim aduan, mendapatkan nomor pelacakan, dan memantau perkembangan penanganan secara transparan tanpa perlu membuat akun. Platform ini juga menyediakan panel petugas dan admin untuk memverifikasi, memperbarui status, menolak aduan, dan mengekspor laporan dalam format Excel.

Project ini cocok digunakan untuk instansi pemerintahan, kelurahan, kecamatan, atau layanan publik yang membutuhkan sistem pengaduan yang cepat, rapi, dan mudah diakses oleh masyarakat.

## Ringkasan singkat

- Public portal untuk warga mengajukan aduan
- Nomor pelacakan unik untuk setiap laporan
- Proses perubahan status yang terdokumentasi dengan riwayat
- Email konfirmasi dan notifikasi otomatis ke pelapor
- Dashboard petugas dan admin dengan filter, statistik, dan ekspor laporan
- Dukungan bukti foto seperti JPG, PNG, WebP, HEIC, HEIF
- Role-based access untuk petugas dan admin
- Teknologi utama: Node.js + Express + Supabase + ExcelJS + Brevo

## Fokus website

Website ini dirancang sesuai dengan alur layanan pengaduan modern yang umum digunakan di layanan publik:

1. Warga membuka halaman beranda
2. Memilih menu “Buat aduan”
3. Mengisi kategori, lokasi, deskripsi, nama, email, serta bukti foto
4. Sistem membuat aduan baru dengan nomor pelacakan
5. Pelapor menerima konfirmasi email berisi tautan tracking
6. Petugas memeriksa aduan dan memperbarui status
7. Warga dapat melihat perkembangan status, memberi balasan, dan memberi rating

Dengan desain seperti ini, masyarakat tidak perlu login untuk melapor, namun tetap bisa memantau perkembangan aduan mereka lewat kode pelacakan.

## Fitur utama

### 1. Portal publik yang sederhana
- Halaman beranda menjelaskan alur penanganan
- Menu utama: Beranda, Lacak aduan, Buat aduan, Masuk petugas
- Desain responsif dengan tema terang dan gelap
- Pengguna dapat langsung masuk ke fitur pelacakan atau pembuatan aduan

### 2. Pelaporan tanpa akun
- Warga tidak perlu mendaftar untuk membuat aduan
- Form pengaduan mencakup:
  - kategori masalah
  - lokasi / alamat
  - deskripsi aduan
  - nama dan email kontak
  - prioritas aduan
  - foto bukti
- Setiap aduan akan mendapatkan kode unik seperti `ADU-xxxx`

### 3. Pelacakan aduan transparan
- Pelapor dapat mengecek status aduan berdasarkan nomor pelacakan
- Riwayat perubahan status ditampilkan dengan catatan singkat
- Warga dapat melakukan balasan/respon bila diminta petugas
- Pelapor dapat menilai kualitas layanan setelah penanganan selesai

### 4. Sistem status yang jelas
Status aduan dapat diperbarui oleh petugas/admin dengan alur seperti:
- masuk
- diverifikasi
- sedang diproses
- menunggu informasi tambahan
- ditolak
- selesai

Saat aduan ditolak, alasan penolakan wajib diisi dan tidak bisa disembunyikan dari warga.

### 5. Dashboard petugas dan admin
Dashboard menyediakan fitur berikut:
- daftar aduan per unit/instansi
- filter tanggal dan wilayah
- grafik tren pengaduan
- riwayat perubahan aduan
- notifikasi aduan baru otomatis
- ekspor laporan ke Excel (.xlsx)
- update status dan catatan penanganan
- akses terbatas sesuai role pengguna

### 6. Email notifikasi otomatis
- Pelapor menerima email konfirmasi pendaftaran aduan
- Pemberitahuan dikirim ketika status berubah
- Tautan di email membawa langsung ke halaman tracking aduan tanpa login
- Jika pengiriman email gagal, sistem tetap menyimpan aduan dan memberi opsi kirim ulang

### 7. Dukungan foto bukti
- Mendukung format JPG, PNG, WebP, HEIC, HEIF
- Ukuran foto dibatasi dan diproses dengan cara aman
- HEIC/HEIF dikonversi ke JPEG di browser sebelum dikirim

### 8. Keamanan dan kontrol akses
- Route admin dan staff dibatasi dengan middleware otorisasi
- Variabel environment disimpan di `.env` lokal dan platform deployment
- Service role key hanya digunakan di server/backend
- API public dilindungi rate limiter terhadap spam atau request berlebihan

## Teknologi yang digunakan

| Area | Teknologi |
|---|---|
| Runtime | Node.js 20+ |
| Framework backend | Express.js |
| Database & auth | Supabase |
| Frontend | HTML, CSS, JavaScript, Leaflet |
| Laporan Excel | ExcelJS |
| Email | Brevo API |
| Middleware keamanan | Helmet, express-rate-limit |
| Deployment | Vercel-ready |

## Struktur project

```text
Lapor-main/
├─ .env.example
├─ .env.vercel.example
├─ app.js
├─ package.json
├─ server.js
├─ README.md
├─ vercel.json
├─ api/
│  └─ [...path].js
├─ config/
│  ├─ firebaseAdmin.js
│  └─ supabase.js
├─ controllers/
│  ├─ authController.js
│  └─ complaintController.js
├─ core/
│  ├─ appFactory.js
│  └─ errors.js
│  └─ middleware.js
├─ database/
│  └─ supabase.sql
├─ middleware/
│  └─ staffAuth.js
├─ models/
│  └─ complaintModel.js
├─ public/
│  ├─ index.html
│  ├─ script.js
│  └─ style.css
├─ routes/
│  ├─ authRoutes.js
│  ├─ complaintRoutes.js
│  └─ index.js
├─ scripts/
│  ├─ createAdmin.ps1
│  ├─ migrateFirebaseToSupabase.js
│  ├─ setStaffClaims.js
│  └─ testApi.js
├─ services/
│  ├─ authService.js
│  ├─ complaintReportService.js
│  ├─ complaintService.js
│  ├─ emailService.js
│  └─ complaintReportService.js
├─ utils/
│  └─ validators.js
└─ ...
```

## Persyaratan sistem

Sebelum menjalankan aplikasi, pastikan Anda sudah menyiapkan:

- Node.js versi 20 atau lebih baru
- npm atau pnpm
- Akun Supabase
- API key Brevo untuk pengiriman email
- Akses ke platform deployment bila ingin dipublikasikan

## Setup environment

Salin file `.env.example` menjadi `.env` dan sesuaikan nilainya:

```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BREVO_API_KEY=your-brevo-api-key
SMTP_FROM_EMAIL=noreply@mail.badrussholeh.my.id
SMTP_FROM_NAME=Lacak Aduan
PUBLIC_APP_URL=http://localhost:3000
```

Penjelasan variabel:

- `SUPABASE_URL` — URL project Supabase Anda
- `SUPABASE_ANON_KEY` — key untuk operasi publik / client
- `SUPABASE_SERVICE_ROLE_KEY` — key server-side yang digunakan untuk operasi admin dan internal
- `BREVO_API_KEY` — API key untuk pengiriman email otomatis
- `SMTP_FROM_EMAIL` — alamat pengirim email yang sudah terverifikasi di Brevo
- `SMTP_FROM_NAME` — nama pengirim yang muncul di email
- `PUBLIC_APP_URL` — domain publik aplikasi, penting agar link tracking email bisa dibuka oleh warga

Catatan penting:
- Jangan pernah commit file `.env` ke repository
- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di sisi server
- `PUBLIC_APP_URL` harus mengarah ke domain publik yang dapat diakses warga, bukan hanya localhost saat deployment produksi

## Setup database Supabase

1. Buat project baru di Supabase
2. Buka SQL Editor di dashboard Supabase
3. Jalankan script yang ada di `database/supabase.sql`
4. Pastikan tabel `complaints` berhasil dibuat
5. Jika project sudah memiliki data lama, Anda dapat menggunakan script migrasi Firebase jika diperlukan

File SQL ini berisi struktur dasar untuk menyimpan data aduan, termasuk field utama seperti kode, lokasi, deskripsi, email, status, log, dan metadata lain yang dibutuhkan aplikasi.

## Menyiapkan akun petugas dan admin

Akun staff perlu dibuat di Supabase Authentication. Setelah user dibuat, isi metadata role/unit berdasarkan kebutuhan.

Contoh role:
- `petugas`
- `admin`

Contoh metadata:
- `app_metadata.role = petugas`
- `app_metadata.unit = Seksi Pemeliharaan Jalan`

Gunakan script berikut untuk memberi metadata claim dari environment variable:

```powershell
$env:STAFF_EMAIL = "petugas@instansi.go.id"
$env:STAFF_ROLE = "petugas"
$env:STAFF_UNIT = "Seksi Pemeliharaan Jalan"
$env:STAFF_NAME = "Petugas Jalan"
npm run staff:claims
```

Untuk admin:

```powershell
$env:STAFF_EMAIL = "admin@instansi.go.id"
$env:STAFF_ROLE = "admin"
$env:STAFF_NAME = "Admin Kelurahan"
npm run staff:claims
```

Catatan:
- `STAFF_UNIT` tidak diperlukan untuk role admin
- Pastikan email staff sudah terdaftar di Supabase Auth

## Menjalankan aplikasi lokal

Install dependency:

```bash
npm install
```

Jalankan server:

```bash
npm start
```

Mode development dengan watch:

```bash
npm run dev
```

Buka browser ke:

```text
http://localhost:3000
```

## Alur penggunaan aplikasi

### Sebagai warga
1. Buka halaman utama
2. Klik tombol “Buat aduan baru”
3. Isi formulir aduan:
   - kategori
   - lokasi
   - keterangan masalah
   - nama dan email
   - bukti foto (opsional namun sangat disarankan)
4. Submit aduan
5. Sistem akan menyimpan dan mengirimkan nomor aduan ke email Anda
6. Gunakan nomor pelacakan untuk mengecek perkembangan aduan

### Sebagai petugas/admin
1. Masuk ke panel petugas
2. Lihat daftar aduan yang masuk
3. Filter berdasarkan rentang tanggal atau wilayah
4. Verifikasi aduan, buat update status, atau minta informasi tambahan
5. Jika perlu, tolak aduan dengan alasan yang jelas
6. Selesaikan laporan dan kirim notifikasi otomatis ke pelapor
7. Ekspor laporan untuk kebutuhan arsip atau evaluasi

## API utama

Berikut daftar endpoint utama yang tersedia di aplikasi:

- `GET /api/health` — mengecek status server
- `GET /api/complaints` — daftar aduan publik
- `GET /api/complaints/:code` — melihat detail aduan publik berdasarkan nomor pelacakan
- `POST /api/complaints` — membuat aduan baru
- `POST /api/complaints/:code/confirmation` — mengirim ulang email konfirmasi
- `POST /api/complaints/:code/replies` — mengirim balasan dari warga
- `POST /api/complaints/:code/ratings` — memberi rating ke aduan
- `POST /api/auth/login` — login staff
- `GET /api/auth/me` — mengecek sesi aktif staff
- `POST /api/auth/logout` — logout staff
- `GET /api/staff/complaints` — daftar aduan untuk staff
- `GET /api/staff/complaints/:code` — detail aduan untuk staff
- `PATCH /api/staff/complaints/:code` — update status atau tindak lanjut petugas
- `GET /api/staff/complaints/report.xlsx` — ekspor laporan Excel
- `DELETE /api/staff/complaints` — hapus aduan oleh admin

## Export laporan Excel

Pengguna staff/admin dapat mengekspor data aduan dalam bentuk `.xlsx` berdasarkan filter tanggal dan wilayah tertentu. Fitur ini sangat berguna untuk:

- rekapan mingguan/bulanan
- audit penanganan aduan
- monitoring unit kerja
- pelaporan ke pimpinan atau instansi terkait

## Migrasi data dari Firebase

Jika aplikasi lama masih menggunakan Firebase Realtime Database, Anda dapat menjalankan migrasi ke Supabase dengan perintah berikut:

```powershell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
$env:FIREBASE_DATABASE_URL = "https://your-project-default-rtdb.firebaseio.com"
$env:FIREBASE_DATABASE_SECRET = "your-firebase-database-secret"
$env:FIREBASE_COMPLAINTS_PATH = "complaints"
$env:DRY_RUN = "false"
npm run migrate:firebase
```

Gunakan `DRY_RUN=true` untuk preview data tanpa menulis ke Supabase.

## Deploy ke Vercel

1. Push project ke GitHub
2. Masuk ke Vercel
3. Pilih Add New → Project
4. Pilih repository yang sesuai
5. Gunakan framework preset `Other` atau sesuaikan dengan struktur project
6. Tambahkan environment variables seperti:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BREVO_API_KEY`
   - `SMTP_FROM_EMAIL`
   - `SMTP_FROM_NAME`
   - `PUBLIC_APP_URL`
   - `NODE_ENV=production`
7. Jalankan deploy

Catatan:
- `PUBLIC_APP_URL` disarankan diisi dengan domain publik agar link email bekerja saat aplikasi sudah live
- Jika deployment menggunakan domain Vercel dengan proteksi akses, link email bisa gagal dibuka tanpa login; pastikan konfigurasi publik Anda sesuai

## Keamanan dan best practice

- Simpan semua credential sensitif di environment variable, bukan di kode
- Jangan pernah mempublikasikan `.env` ke Git
- `SUPABASE_SERVICE_ROLE_KEY` hanya untuk server-side
- Hindari mengandalkan nomor aduan sebagai identitas pelapor yang kuat untuk logika otorisasi
- Pastikan semua perubahan status dan penolakan aduan dicatat dengan jelas agar audit trail terbuka
- Batasi request publik agar tidak terjadi spam atau penyalahgunaan

## Troubleshooting

### Error: `SUPABASE_URL is required.`
Pastikan variabel `SUPABASE_URL` sudah ada di file `.env`.

### Error: email konfirmasi gagal terkirim
Periksa:
- `BREVO_API_KEY`
- `SMTP_FROM_EMAIL`
- domain pengirim yang sudah diverifikasi di Brevo

### Error: aduan tidak bisa dibuat
Periksa validasi form seperti:
- kategori tidak valid
- email tidak benar
- deskripsi terlalu panjang
- bukti foto tidak sesuai format atau terlalu besar

### Staff tidak bisa login
Pastikan:
- akun staff sudah dibuat di Supabase Authentication
- metadata `role` dan `unit` sudah diatur dengan benar
- script `npm run staff:claims` sudah dijalankan

## Kesimpulan

Lacak Aduan adalah solusi pengaduan publik yang sederhana, cepat, dan transparan. Dengan pendekatan tanpa akun untuk warga, dashboard yang kuat untuk petugas, dan otomatisasi email yang rapi, aplikasi ini cocok digunakan untuk mendukung pelayanan publik modern serta meningkatkan kepercayaan masyarakat terhadap proses penanganan aduan.

Jika Anda ingin, proyek ini juga bisa dikembangkan lebih lanjut dengan fitur seperti:
- notifikasi WhatsApp
- login SSO instansi
- dashboard analitik yang lebih lengkap
- map interaktif untuk lokasi aduan
- sistem multi-tenant untuk beberapa kelurahan/kecamatan
