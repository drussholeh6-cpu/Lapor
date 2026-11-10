# Lacak Aduan

Aplikasi demo pelaporan dan pelacakan aduan dengan backend Express dan Supabase.

## Struktur utama

```text
core/                  Bootstrap aplikasi & middleware reusable
public/                Frontend statis
config/                Konfigurasi klien Supabase
controllers/           Handler request API (thin layer)
middleware/            Middleware otorisasi petugas
models/                Model akses data aduan
services/              Business logic & validasi domain
utils/                 Helper reusable seperti validator
routes/                Route API & registrasi routing
scripts/               Utility admin & migrasi data
database/              Schema SQL untuk Supabase
server.js              Entry point aplikasi
app.js                 Export app instance untuk test/bootstrapping
```

Catatan:
- Struktur sudah dibuat lebih modular agar mirip app factory/framework mini.
- File lama yang masih tersisa hanya sebagai kompatibilitas mundur dan tidak lagi dipakai di flow utama.
- Logika inti sudah dipusatkan di `config/supabase.js` agar struktur lebih rapi.

## Persiapan

1. Buat project Supabase baru.
2. Di dashboard Supabase, buka Authentication → Users.
3. Buat akun petugas dengan email/password.
4. Untuk role `admin` atau `petugas`, isi metadata seperti `app_metadata.role` dan `app_metadata.unit`.
5. Jalankan SQL di `database/supabase.sql` untuk membuat tabel `complaints`.
6. Salin `.env.example` ke `.env` lalu isi variabel berikut:

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

Email pengonfirmasi nomor aduan dikirim melalui Brevo transactional email API lewat HTTPS (kompatibel dengan Vercel Functions), dengan template HTML responsif serta versi teks alternatif. Tautan di email membuka resi aduan secara langsung tanpa login. Buat API key di Brevo dan verifikasi domain pengirim, lalu gunakan email pengirim yang terdaftar di `SMTP_FROM_EMAIL`. Simpan `BREVO_API_KEY` hanya di environment lokal atau platform deployment, jangan di frontend maupun repository. Di Vercel, atur variabel tersebut di **Project Settings → Environment Variables**. Atur `PUBLIC_APP_URL` ke domain aplikasi publik/produksi yang dapat dibuka warga. Jika **Deployment Protection** Vercel aktif untuk domain itu, nonaktifkan perlindungan untuk deployment produksi atau gunakan domain publik; tautan email tidak dapat melewati halaman login Vercel.

Email konfirmasi wajib berhasil dikirim agar pengajuan dianggap berhasil. Kredensial atau konfigurasi yang belum tersedia akan menolak pengajuan sebelum menyimpan aduan. Jika Brevo mengalami gangguan setelah aduan tersimpan, aplikasi menampilkan nomor aduan dan tombol **Kirim ulang email**; pengiriman ulang dibatasi 5 kali per jam.

Setiap perubahan status oleh petugas/admin, termasuk permintaan informasi tambahan, mengirim email pemberitahuan kepada pengadu. Catatan internal tidak disertakan dalam email. Jika pengiriman gagal, perubahan tetap tersimpan dan dashboard memberi tahu petugas/admin.

Foto bukti mendukung JPG, PNG, WebP, HEIC, dan HEIF hingga 10 MB sebelum dikompres. HEIC/HEIF dikonversi ke JPEG di browser sebelum dikirim.

## Role petugas

```powershell
$env:STAFF_EMAIL = "petugas@instansi.go.id"
$env:STAFF_ROLE = "petugas"
$env:STAFF_UNIT = "Seksi Pemeliharaan Jalan"
$env:STAFF_NAME = "Petugas Jalan"
npm run staff:claims
```

Untuk admin, gunakan `STAFF_ROLE=admin` dan abaikan `STAFF_UNIT`.

## Dashboard petugas dan admin

Dashboard menyediakan filter rentang tanggal dan wilayah (diambil dari bagian alamat setelah nama jalan), grafik tren pengaduan, riwayat perubahan, serta notifikasi aduan baru yang diperbarui otomatis setiap menit selama sesi aktif. Laporan yang sedang difilter dapat diunduh sebagai file Excel `.xlsx` dengan judul, format tabel, lebar kolom, dan filter otomatis.

Saat petugas atau admin memilih status **Tolak aduan**, alasan penolakan wajib diisi pada kolom khusus dan selalu ditampilkan kepada warga pada riwayat status.

## Migrasi data lama dari Firebase

Jika data lama masih berada di Firebase Realtime Database, gunakan script migrasi ini:

```powershell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
$env:FIREBASE_DATABASE_URL = "https://your-project-default-rtdb.firebaseio.com"
$env:FIREBASE_DATABASE_SECRET = "your-firebase-database-secret"
$env:FIREBASE_COMPLAINTS_PATH = "complaints"
$env:DRY_RUN = "false"
npm run migrate:firebase
```

Gunakan `DRY_RUN=true` untuk preview tanpa menulis data ke Supabase.

## Menjalankan lokal

```powershell
npm install
npm start
```

Buka `http://localhost:3000`.

## Deploy ke Vercel

1. Push repository ke GitHub.
2. Di Vercel pilih Add New → Project.
3. Pilih branch `main` dan framework preset `Other`.
4. Tambahkan environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, dan `NODE_ENV=production`. `PUBLIC_APP_URL` opsional di Vercel.
5. Deploy.

## API utama

- `GET /api/health` — cek status server
- `GET /api/complaints` — daftar publik aduan
- `GET /api/complaints/:code` — tracking aduan publik
- `POST /api/complaints` — buat aduan baru
- `POST /api/complaints/:code/replies` — balasan warga
- `POST /api/complaints/:code/ratings` — rating
- `POST /api/auth/login` — login petugas
- `GET /api/auth/me` — cek sesi petugas
- `POST /api/auth/logout` — logout
- `GET /api/staff/complaints` — daftar aduan petugas
- `PATCH /api/staff/complaints/:code` — update status/aksi petugas
- `DELETE /api/staff/complaints` — hapus aduan oleh admin

## Schema Supabase

File `database/supabase.sql` berisi contoh minimal:

```sql
create table if not exists complaints (
  code text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger complaints_set_updated_at
before update on complaints
for each row
execute function set_updated_at();
```

## Batasan keamanan

- Simpan `SUPABASE_SERVICE_ROLE_KEY` hanya di server/backend.
- Jangan commit file `.env` atau credential lain ke repository.
- Data publik perlu di-review sebelum dipakai di lingkungan produksi.
- Nomor aduan bukan identitas pelapor yang kuat.
