# Lacak Aduan

Demo aplikasi pelaporan dan pelacakan aduan. Frontend statis berada di `public/`; backend Express menangani API, Firebase Authentication untuk petugas, dan Firebase Realtime Database untuk data aduan.

## Struktur

```text
public/                 Frontend HTML, CSS, JavaScript
config/                 Inisialisasi Firebase Admin SDK
controllers/            Handler API
middleware/             Sesi dan otorisasi petugas
models/                 Akses Realtime Database
routes/                 Route API
scripts/                Utilitas administrasi akun petugas
server.js               Entry point Express
```

## Persiapan Firebase

1. Buat project Firebase, aktifkan **Realtime Database**, lalu catat URL database dari Firebase Console.
2. Aktifkan **Authentication → Sign-in method → Email/Password** dan buat akun petugas melalui Firebase Authentication.
3. Buat Service Account key hanya setelah key yang pernah terekspos sudah dicabut. Simpan file secara aman sebagai `serviceAccountKey.json` untuk lokal. File itu sudah masuk `.gitignore`; jangan commit atau membagikannya.
4. Di Realtime Database → Rules, terapkan isi `database.rules.json`. Server memakai Admin SDK dan dapat mengakses database; klien browser tidak mendapat akses langsung.
5. Salin `.env.example` ke `.env`, lalu isi `FIREBASE_DATABASE_URL` dan `FIREBASE_WEB_API_KEY` dari konfigurasi Firebase Web App. Untuk lokal, `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json` menunjuk ke key privat lokal. Jangan pernah meng-commit key tersebut.

Contoh `.env`:

```env
NODE_ENV=development
PORT=3000
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_WEB_API_KEY=your-firebase-web-api-key
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

## Memberi akses petugas

Buat akun terlebih dahulu di Firebase Authentication. Kemudian jalankan PowerShell berikut, dengan kredensial lokal dan database sudah diatur di `.env`:

```powershell
$env:STAFF_EMAIL = "petugas@instansi.go.id"
$env:STAFF_ROLE = "petugas"
$env:STAFF_UNIT = "Seksi Pemeliharaan Jalan"
$env:STAFF_NAME = "Petugas Jalan"
npm run staff:claims
```

Untuk admin, gunakan `STAFF_ROLE=admin`; `STAFF_UNIT` tidak diperlukan. Custom claims ditetapkan memakai Admin SDK, bukan dari browser.

## Menjalankan lokal

Gunakan Node.js 20 atau lebih baru:

```powershell
npm install
npm start
```

Buka `http://localhost:3000`. Jika Firebase environment belum diatur, halaman dapat terbuka tetapi endpoint data akan memberi respons konfigurasi belum tersedia.

## Deploy ke Vercel

1. Push source ke GitHub. Jangan tambahkan `.env` atau `serviceAccountKey.json`.
2. Di Vercel pilih **Add New → Project**, impor repository GitHub, lalu pilih branch `main`.
3. Pilih Framework Preset **Other**. Biarkan Root Directory di root proyek, Output Directory kosong, dan jangan isi Start Command. Vercel akan membangun folder `public/` sebagai frontend dan `api/[...path].js` sebagai function untuk API.
4. Di **Project → Settings → Environment Variables**, tambahkan `FIREBASE_DATABASE_URL`, `FIREBASE_WEB_API_KEY`, dan `FIREBASE_SERVICE_ACCOUNT_JSON`. Masukkan seluruh JSON key baru sebagai nilai variable rahasia, bukan sebagai file di repository.
5. Tambahkan `NODE_ENV=production`, lalu deploy. Vercel akan memberi URL; API tersedia pada `/api/health` dan frontend pada `/`.
6. Untuk deploy berikutnya, push commit baru ke branch yang terhubung. Vercel akan membangun ulang project.

Vercel menjalankan API sebagai serverless function, bukan server `npm start` yang selalu hidup. `npm start` tetap dipakai untuk pengembangan lokal. Firebase Realtime Database dan Authentication tetap menjadi layanan terpisah.

## API

- `GET /api/health` — pemeriksaan server
- `GET /api/complaints` — daftar publik tanpa nama pelapor, foto, audit, atau catatan internal
- `GET /api/complaints/:code` — pelacakan publik
- `POST /api/complaints` — membuat aduan
- `POST /api/complaints/:code/replies` — mengirim jawaban informasi warga
- `POST /api/complaints/:code/ratings` — mengirim rating
- `POST /api/auth/login` — masuk dengan akun Firebase Authentication yang memiliki custom claim petugas/admin
- `GET /api/auth/me` — memeriksa sesi petugas
- `POST /api/auth/logout` — keluar
- `GET /api/staff/complaints` — daftar yang dibatasi berdasarkan role/unit
- `PATCH /api/staff/complaints/:code` — pembaruan petugas
- `DELETE /api/staff/complaints` — penghapusan admin

Sesi petugas menggunakan cookie HTTP-only, Secure pada produksi, SameSite Strict, dan masa berlaku lima hari. Backend memeriksa Firebase session cookie serta role custom claims pada setiap request petugas. CORS tidak dibuka untuk origin lain. Pembatasan percobaan login di memory dapat ter-reset antar-serverless invocation; untuk produksi publik, gunakan penyimpanan rate limit bersama seperti Redis.

## Batasan dan keamanan

- Demo ini belum menggantikan audit keamanan atau kebijakan privasi untuk data publik nyata.
- Balasan dan rating warga saat ini menggunakan nomor aduan sebagai bukti akses; nomor tersebut bukan autentikasi identitas pelapor yang kuat.
- Deskripsi aduan dan titik koordinat ditampilkan di endpoint publik untuk papan/tracking. Tinjau data sensitif sebelum produksi.
- Foto disimpan sebagai JPEG di Realtime Database; untuk produksi, pertimbangkan Firebase Storage dengan aturan akses yang sesuai.
- Jangan pernah commit `.env`, `serviceAccountKey.json`, atau kredensial lain. Jika key pernah dibagikan, cabut di Google Cloud IAM dan buat key baru.
