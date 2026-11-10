# Lacak Aduan

## Deskripsi Proyek

Lacak Aduan adalah sistem pengaduan masyarakat berbasis web yang dirancang untuk memfasilitasi proses pelaporan, pelacakan, dan penanganan aduan secara terstruktur dan transparan. Aplikasi ini memungkinkan warga untuk mengirimkan laporan terkait kondisi lingkungan, fasilitas publik, layanan pemerintahan, atau permasalahan sosial yang membutuhkan tindak lanjut dari unit terkait.

Sistem ini dirancang untuk mendukung dua pihak utama:

- Warga atau masyarakat umum sebagai pelapor
- Petugas atau administrator sebagai pihak yang memproses dan menindaklanjuti laporan

Dengan arsitektur berbasis Node.js dan Supabase, aplikasi ini dapat digunakan sebagai solusi pengelolaan aduan yang aman, terukur, dan mudah dikembangkan untuk kebutuhan organisasi pemerintahan atau layanan publik.

## Tujuan

Tujuan utama dari aplikasi ini adalah:

- memberikan kanal pengaduan yang mudah diakses oleh masyarakat
- memastikan setiap aduan memiliki identitas unik dan dapat dilacak
- memudahkan petugas dalam memantau status aduan dari tahap awal hingga selesai
- meningkatkan transparansi proses penanganan aduan kepada publik
- meminimalkan kesenjangan komunikasi antara warga, petugas, dan unit penanganan

## Fitur Utama

- Formulir pengaduan publik tanpa perlu login akun
- Pembuatan nomor aduan unik untuk setiap laporan
- Pelacakan aduan berdasarkan kode aduan dan email pelapor
- Dashboard petugas untuk melihat daftar aduan masuk
- Akses berbasis peran (`admin` dan `petugas`)
- Pembaruan status aduan oleh petugas dan pemberitahuan kepada pelapor
- Notifikasi email otomatis untuk konfirmasi penerimaan dan update status
- Statistik publik mengenai jumlah aduan, tren, dan unit penanganan
- Export data aduan ke format Excel
- Integrasi dengan peta untuk menampilkan lokasi kejadian atau laporan
- Penyimpanan bukti pendukung aduan pada storage Supabase

## Alur Proses Bisnis

### 1. Pelapor

1. Warga membuka halaman utama aplikasi.
2. Mengisi formulir aduan dengan data seperti kategori, lokasi, deskripsi, dan kontak.
3. Sistem menyimpan laporan dan menghasilkan kode aduan unik.
4. Email konfirmasi dikirimkan ke pelapor.
5. Pelapor dapat memantau perkembangan aduan melalui kode aduan dan email yang didaftarkan.

### 2. Petugas

1. Petugas masuk ke area internal menggunakan akun yang terdaftar.
2. Sistem menampilkan daftar aduan yang masuk dan siap ditangani.
3. Petugas dapat meninjau detail laporan, memperbarui status, dan menambahkan catatan tindak lanjut.
4. Jika diperlukan, sistem mengirim notifikasi email kepada pelapor terkait perubahan status.
5. Data aduan dapat diekspor untuk kebutuhan laporan dan evaluasi performa.

### 3. Admin

1. Admin memiliki akses lebih luas dibanding petugas biasa.
2. Dapat mengelola akun petugas, melakukan perubahan peran, serta memastikan kelengkapan struktur organisasi.
3. Memastikan kebijakan dan otorisasi dalam sistem berjalan sesuai peraturan yang berlaku.

## Arsitektur Aplikasi

Aplikasi ini dibangun dengan pola modular yang memisahkan concern secara jelas, antara lain:

- `routes/` untuk mendefinisikan endpoint HTTP
- `controllers/` untuk menangani request dan response
- `services/` untuk logika bisnis dan integrasi eksternal
- `config/` untuk konfigurasi layanan seperti Supabase
- `core/` untuk inisialisasi aplikasi, middleware, dan error handling
- `middleware/` untuk autentikasi dan validasi request
- `utils/` untuk helper dan fungsi pendukung
- `public/` untuk frontend statis yang dapat diakses pengguna
- `database/` untuk schema database dan migrasi awal
- `scripts/` untuk tugas administratif dan utilitas operasional

## Teknologi yang Digunakan

- Node.js 20+
- Express.js
- Supabase
  - Database PostgreSQL
  - Authentication
  - Storage
- Brevo (email delivery service)
- Leaflet
- ExcelJS
- dotenv
- Helmet
- express-rate-limit

## Struktur Direktori

```text
Lapor/
├─ app.js
├─ server.js
├─ package.json
├─ vercel.json
├─ README.md
├─ public/                         # antarmuka frontend publik
│  ├─ index.html
│  ├─ script.js
│  ├─ style.css
├─ routes/
│  ├─ authRoutes.js
│  ├─ complaintRoutes.js
│  └─ index.js
├─ controllers/
│  ├─ authController.js
│  └─ complaintController.js
├─ services/
│  ├─ authService.js
│  ├─ complaintService.js
│  ├─ complaintReportService.js
│  ├─ emailService.js
│  └─ publicStatisticsService.js
├─ models/
│  └─ complaintModel.js
├─ config/
│  ├─ firebaseAdmin.js
│  └─ supabase.js
├─ core/
│  ├─ appFactory.js
│  ├─ errors.js
│  └─ middleware.js
├─ middleware/
│  ├─ mathChallenge.js
│  └─ staffAuth.js
├─ utils/
│  └─ validators.js
├─ scripts/
│  ├─ createAdmin.ps1
│  ├─ migrateFirebaseToSupabase.js
│  ├─ setStaffClaims.js
│  ├─ testApi.js
├─ database/
│  └─ supabase.sql
├─ tests/
│  └─ publicStatistics.test.js
└─ .env.example (jika digunakan)
```

## Persyaratan Sistem

Sebelum menjalankan aplikasi, pastikan perangkat Anda sudah memiliki:

- Node.js versi 20 atau lebih tinggi
- npm atau package manager yang kompatibel
- Akun Supabase aktif
- Koneksi internet untuk mengakses layanan eksternal seperti email dan Supabase
- Akses ke penyimpanan dan konfigurasi environment di server atau local development

## Setup Environment

Buat file `.env` di root project dan sesuaikan nilainya dengan konfigurasi lingkungan Anda.

```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

PUBLIC_APP_URL=http://localhost:3000
BREVO_API_KEY=your_brevo_api_key
SMTP_FROM_EMAIL=no-reply@domain.com
SMTP_FROM_NAME=Lacak Aduan
```

### Penjelasan Variabel

- `PORT`: port aplikasi yang digunakan oleh Express
- `NODE_ENV`: lingkungan runtime (`development`, `production`, dll.)
- `SUPABASE_URL`: URL project Supabase
- `SUPABASE_ANON_KEY`: kunci anon untuk akses publik terbatas
- `SUPABASE_SERVICE_ROLE_KEY`: kunci server-side yang digunakan untuk operasi admin dan internal
- `PUBLIC_APP_URL`: base URL aplikasi yang digunakan dalam tautan email dan notifikasi
- `BREVO_API_KEY`: API key untuk layanan email Brevo
- `SMTP_FROM_EMAIL`: alamat email pengirim notifikasi
- `SMTP_FROM_NAME`: nama pengirim yang akan tampil pada email

## Langkah Instalasi

### 1. Clone Repositori

```bash
git clone <repository-url>
cd Lapor
```

### 2. Install Dependency

```bash
npm install
```

### 3. Konfigurasi Environment

Siapkan file `.env` berdasarkan contoh variabel di atas, kemudian sesuaikan dengan nilai environment Anda.

### 4. Setup Database Supabase

Import file SQL berikut ke project Supabase Anda:

```text
database/supabase.sql
```

File SQL tersebut berfungsi untuk:

- membuat tabel aduan (`complaints`)
- membuat tabel profil petugas (`staff_profiles`)
- menyiapkan trigger `updated_at`
- mengatur bucket storage untuk bukti aduan
- membuat policy akses publik terhadap file bukti

### 5. Jalankan Aplikasi

Untuk mode development:

```bash
npm run dev
```

Untuk mode production:

```bash
npm start
```

Aplikasi default akan berjalan pada:

```text
http://localhost:3000
```

## Perintah yang Tersedia

```bash
npm start                  # menjalankan aplikasi dalam mode produksi
npm run dev                # menjalankan aplikasi dengan watch mode
npm run staff:claims       # menjalankan script pengaturan claim petugas
npm run migrate:firebase   # migrasi data dari Firebase ke Supabase
npm run test:api           # menjalankan uji API dasar
```

## Komponen Utama

### 1. Server dan App Bootstrap

File utama aplikasi:

- `server.js` — entry point untuk menjalankan server
- `app.js` — ekspor aplikasi yang dibuat dari factory
- `core/appFactory.js` — inisialisasi Express app dan registrasi middleware

### 2. Routing

Endpoint utama didefinisikan dalam:

- `routes/authRoutes.js`
- `routes/complaintRoutes.js`
- `routes/index.js`

### 3. Controller

Controller menangani input request dan mengembalikan response sesuai kebutuhan:

- `controllers/authController.js`
- `controllers/complaintController.js`

### 4. Service Layer

Business logic dibagi ke dalam beberapa service:

- `services/authService.js` — autentikasi dan manajemen akun petugas
- `services/complaintService.js` — pengolahan data aduan
- `services/emailService.js` — notifikasi email penerimaan dan update
- `services/publicStatisticsService.js` — perhitungan statistik publik
- `services/complaintReportService.js` — ekspor laporan Excel

### 5. Middleware

Middleware yang digunakan untuk memproteksi, memvalidasi, dan mengamankan proses:

- `middleware/staffAuth.js` — autentikasi staf dan validasi peran akun
- `middleware/mathChallenge.js` — middleware yang dapat digunakan untuk challenge sederhana terhadap bot atau request otomatis

## Endpoint API

Berikut beberapa endpoint yang tersedia pada aplikasi.

### Health Check

```http
GET /api/health
```

Mengembalikan status aplikasi dan koneksi ke database.

### Autentikasi Petugas

```http
POST /api/auth/login
GET /api/auth/me
POST /api/auth/logout
GET /api/auth/staff
POST /api/auth/staff/register
PATCH /api/auth/staff/update
DELETE /api/auth/staff/delete
```

### Pengaduan Publik

```http
POST /api/complaints
GET /api/complaints/:code
POST /api/complaints/:code/reply
POST /api/complaints/:code/rating
GET /api/public-statistics
```

### Manajemen Aduan Petugas

```http
GET /api/staff/complaints
GET /api/staff/complaints/:code
PATCH /api/staff/complaints/:code
DELETE /api/staff/complaints
GET /api/staff/report/export
```

> Catatan: detail endpoint dapat berkembang sesuai kebutuhan pengembangan dan perbaikan sistem. Pastikan untuk memeriksa file routing yang tersedia di `routes/` untuk dokumentasi yang selalu mutakhir.

## Model Data Utama

### `complaints`

Tabel utama yang menyimpan data aduan. Struktur utama umumnya mencakup:

- `code`: kode aduan unik
- `data`: payload aduan dalam format JSON
- `created_at`: waktu dibuat
- `updated_at`: waktu terakhir diperbarui

### `staff_profiles`

Tabel profil petugas dan admin yang memuat:

- `email`
- `name`
- `role`
- `unit`
- `status`
- `auth_user_id`
- `created_at`
- `updated_at`

## Keamanan

Aplikasi ini memperhatikan beberapa aspek keamanan dasar, di antaranya:

- penggunaan environment variable untuk menyimpan secret
- autentikasi berbasis cookie untuk session petugas
- validasi input dasar pada form dan request HTTP
- penggunaan Supabase service role hanya untuk operasi backend internal
- pemisahan peran admin dan petugas untuk membatasi akses
- penggunaan HTTPS pada environment production untuk URL publik
- proteksi terhadap request berlebihan melalui rate limiting

## Deployment

Untuk environment produksi, disarankan untuk:

- menggunakan HTTPS secara penuh
- menyimpan variabel environment pada platform hosting yang aman
- membatasi akses ke service role key hanya pada server backend
- mengaktifkan monitoring log dan error tracking
- melakukan validasi konfigurasi email sebelum digunakan secara massal
- menjaga `PUBLIC_APP_URL` sesuai dengan domain production yang benar

## Catatan Pengembangan

Beberapa file utility dan script membantu dalam pengelolaan sistem, antara lain:

- `scripts/setStaffClaims.js` — digunakan untuk mengatur klaim peran petugas
- `scripts/migrateFirebaseToSupabase.js` — migrasi data lama dari Firebase ke Supabase
- `scripts/createAdmin.ps1` — membuat akun admin secara otomatis melalui PowerShell
- `scripts/testApi.js` — testing endpoint API secara cepat

## Pengujian

Project ini sudah mencakup uji statistik publik pada file:

```text
tests/publicStatistics.test.js
```

Direkomendasikan untuk menjalankan uji yang relevan sebelum deployment atau pengiriman perubahan penting.

## Lisensi

Saat ini proyek ini belum memiliki lisensi formal yang eksplisit. Jika proyek ini akan digunakan dalam lingkungan komersial atau institusional, disarankan untuk menambahkan lisensi yang sesuai dengan kebijakan organisasi atau tim pengembang.

## Kontribusi

Kontribusi sangat terbuka untuk pengembangan lebih lanjut. Prinsip umum yang disarankan:

- membuat branch baru untuk setiap perubahan
- menjaga perubahan tetap fokus pada satu tujuan per commit
- menjalankan validasi atau pengujian yang relevan
- menulis deskripsi perubahan yang jelas pada pull request
- memastikan tidak ada konfigurasi sensitif yang tercantum dalam source code

## Penutup

Lacak Aduan dirancang sebagai solusi digital untuk memperkuat sistem pengaduan publik agar lebih cepat, transparan, dan akuntabel. Dengan pendekatan berbasis web dan integrasi layanan modern seperti Supabase dan Brevo, aplikasi ini dapat menjadi fondasi yang kuat untuk pengelolaan aduan di lingkungan pemerintahan, layanan publik, atau organisasi yang membutuhkan mekanisme pelaporan yang terdokumentasi dengan baik.

Jika Anda ingin, saya juga bisa membuatkan versi README yang lebih singkat untuk GitHub profile/external documentation, atau versi yang lebih teknis untuk tim developer. 
