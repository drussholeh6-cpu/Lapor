param(
    [string]$SupabaseUrl,
    [string]$ServiceRoleKey,
    [string]$AdminEmail = "admin@instansi.go.id",
    [string]$AdminPassword = "Admin123!",
    [string]$AdminName = "Admin Utama"
)

function Get-EnvValue {
    param([string]$Key)

    $value = [System.Environment]::GetEnvironmentVariable($Key, "Process")
    if ($value) { return $value }

    $value = [System.Environment]::GetEnvironmentVariable($Key, "User")
    if ($value) { return $value }

    $envFile = Join-Path (Get-Location) ".env"
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            $trimmed = $line.Trim()
            if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
            $parts = $trimmed -split "=", 2
            if ($parts.Length -eq 2 -and $parts[0].Trim() -eq $Key) {
                return $parts[1].Trim().Trim('"')
            }
        }
    }

    return $null
}

if (-not $SupabaseUrl) {
    $SupabaseUrl = Get-EnvValue "SUPABASE_URL"
}
if (-not $ServiceRoleKey) {
    $ServiceRoleKey = Get-EnvValue "SUPABASE_SERVICE_ROLE_KEY"
}
if (-not $AdminEmail) {
    $AdminEmail = "admin@instansi.go.id"
}
if (-not $AdminPassword) {
    $AdminPassword = "Admin123!"
}

if (-not $SupabaseUrl) {
    throw "SupabaseUrl tidak ditemukan di .env atau environment. Pastikan SUPABASE_URL sudah diisi."
}
if (-not $ServiceRoleKey) {
    throw "SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env atau environment."
}

Write-Host "Membuat akun admin memakai URL dan service role dari environment/.env..."

$env:SUPABASE_URL = $SupabaseUrl
$env:SUPABASE_SERVICE_ROLE_KEY = $ServiceRoleKey
$env:ADMIN_EMAIL = $AdminEmail
$env:ADMIN_PASSWORD = $AdminPassword
$env:ADMIN_NAME = $AdminName

$script = @'
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Admin Utama").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi.");
  }
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL dan ADMIN_PASSWORD harus diisi.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: tableCheck, error: tableCheckError } = await supabase.from("staff_profiles").select("email").limit(1);
  if (tableCheckError && tableCheckError.code === "42P01") {
    console.error("TABEL staff_profiles BELUM ADA di database Supabase.");
    console.error("Jalankan dulu SQL di database/supabase.sql dari Supabase SQL Editor.");
    console.error("Setelah itu jalankan script lagi.");
    process.exit(1);
  }
  if (tableCheckError) {
    throw new Error("Gagal memeriksa table staff_profiles: " + tableCheckError.message);
  }

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  let user = (usersData?.users || []).find((u) => (u.email || "").toLowerCase() === email);

  if (!user) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        staffName: name,
        role: "admin",
        unit: "",
      },
      app_metadata: {
        role: "admin",
        unit: "",
        staffName: name,
      },
    });

    if (createError) throw createError;
    user = created?.user;
  }

  if (!user) {
    throw new Error("Gagal mendapatkan akun admin dari Supabase Auth.");
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      role: "admin",
      unit: "",
      staffName: name,
    },
    user_metadata: {
      ...(user.user_metadata || {}),
      name,
      staffName: name,
      role: "admin",
      unit: "",
    },
  });

  if (updateError) throw updateError;

  const { error: profileError } = await supabase
    .from("staff_profiles")
    .upsert(
      {
        email,
        name,
        role: "admin",
        unit: "",
        status: "registered",
        auth_user_id: user.id,
      },
      { onConflict: "email" }
    );

  if (profileError) throw profileError;

  console.log("AKUN_ADMIN_SIAAP");
  console.log(JSON.stringify({
    email,
    name,
    role: "admin",
    status: "registered",
    auth_user_id: user.id,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
'@

$script | node -
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Username/admin siap dipakai:"
Write-Host "Email: $AdminEmail"
Write-Host "Password: $AdminPassword"
