#!/usr/bin/env node
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_COMPLAINTS_PATH = 'complaints';

function getFirebaseDatabaseUrl() {
  const databaseUrl = process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_URL || process.env.FIREBASE_DB_URL;
  if (!databaseUrl) {
    throw new Error('FIREBASE_DATABASE_URL belum diatur. Contoh: https://nama-project-default-rtdb.firebaseio.com');
  }

  return String(databaseUrl).replace(/\/+$/, '');
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diatur sebelum migrasi.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isComplaintLike(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return ['code', 'cat', 'loc', 'text', 'unit', 'priority', 'at', 'log', 'audit', 'coordinates', 'name'].some((key) => key in value);
}

function normalizeLegacyComplaint(raw, fallbackCode) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const complaint = { ...raw };
  const code = String(complaint.code || complaint.id || fallbackCode || '').trim();
  if (!code) {
    return null;
  }

  if (!complaint.at && complaint.createdAt) complaint.at = complaint.createdAt;
  if (!complaint.at && complaint.created_at) complaint.at = complaint.created_at;
  if (!complaint.cat && complaint.category) complaint.cat = complaint.category;
  if (!complaint.loc && complaint.location) complaint.loc = complaint.location;
  if (!complaint.text && complaint.description) complaint.text = complaint.description;
  if (!complaint.name && complaint.pelapor) complaint.name = complaint.pelapor;
  if (!complaint.log || !Array.isArray(complaint.log)) complaint.log = [];
  if (!complaint.audit || !Array.isArray(complaint.audit)) complaint.audit = [];
  if (typeof complaint.waitingForInfo !== 'boolean') complaint.waitingForInfo = Boolean(complaint.waitingForInfo);
  if (!complaint.coordinates && complaint.lat != null && complaint.lng != null) {
    complaint.coordinates = { lat: Number(complaint.lat), lng: Number(complaint.lng) };
  }

  complaint.code = code;
  delete complaint.id;
  delete complaint.created_at;
  delete complaint.updated_at;

  return { code, data: complaint };
}

function flattenFirebaseRecords(node, fallbackKey = '') {
  const results = [];

  if (!node || typeof node !== 'object') {
    return results;
  }

  if (Array.isArray(node)) {
    node.forEach((entry, index) => {
      const record = normalizeLegacyComplaint(entry, `${fallbackKey || 'legacy'}-${index}`);
      if (record) {
        results.push(record);
      }
    });
    return results;
  }

  const keys = Object.keys(node);
  const complaintLike = isComplaintLike(node);
  if (complaintLike) {
    const record = normalizeLegacyComplaint(node, fallbackKey);
    if (record) {
      return [record];
    }
  }

  for (const key of keys) {
    const child = node[key];
    if (child && typeof child === 'object') {
      const nested = flattenFirebaseRecords(child, key);
      results.push(...nested);
    }
  }

  return results;
}

async function fetchFirebaseLegacyComplaints() {
  const databaseUrl = getFirebaseDatabaseUrl();
  const databaseSecret = process.env.FIREBASE_DATABASE_SECRET || process.env.FIREBASE_SECRET;
  const complaintsPath = process.env.FIREBASE_COMPLAINTS_PATH || DEFAULT_COMPLAINTS_PATH;

  if (!databaseSecret) {
    throw new Error('FIREBASE_DATABASE_SECRET belum diatur. Jika menggunakan Firebase Realtime Database, isi secret dari project settings.');
  }

  const endpoint = new URL(`${databaseUrl.replace(/\/+$/, '')}/${String(complaintsPath).replace(/^\/+|\/+$/g, '')}.json`);
  endpoint.searchParams.set('auth', databaseSecret);

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gagal mengambil data legacy Firebase (${response.status}): ${details || response.statusText}`);
  }

  const payload = await response.json();
  return flattenFirebaseRecords(payload);
}

async function upsertComplaints(supabase, records) {
  if (!records.length) {
    return { inserted: 0, skipped: 0 };
  }

  const payload = records.map(({ code, data }) => ({ code, data }));
  const { error } = await supabase
    .from('complaints')
    .upsert(payload, { onConflict: 'code' });

  if (error) {
    throw error;
  }

  return { inserted: payload.length, skipped: 0 };
}

async function main() {
  const isDryRun = ['1', 'true', 'yes', 'y'].includes(String(process.env.DRY_RUN || '').toLowerCase());

  const sourceRecords = await fetchFirebaseLegacyComplaints();
  console.log(`Ditemukan ${sourceRecords.length} aduan legacy dari Firebase.`);

  if (isDryRun) {
    console.log('Mode dry-run aktif. Tidak ada data yang ditulis ke Supabase.');
    console.log(JSON.stringify(sourceRecords.slice(0, 5), null, 2));
    return;
  }

  const supabase = getSupabaseClient();
  const result = await upsertComplaints(supabase, sourceRecords);
  console.log(`Migrasi selesai. ${result.inserted} data berhasil diproses.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
