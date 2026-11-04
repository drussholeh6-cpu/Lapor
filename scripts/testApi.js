const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    payload,
  };
}

async function main() {
  console.log('Testing API at:', baseUrl);

  const health = await request('/api/health');
  console.log('GET /api/health =>', health.status, health.payload);

  const complaintPayload = {
    cat: 'Sampah',
    loc: 'Jl. Test API',
    text: 'Tes otomatis API backend untuk validasi pembuatan aduan.',
    name: 'Tester Bot',
    priority: 'normal',
  };

  const createComplaint = await request('/api/complaints', {
    method: 'POST',
    body: JSON.stringify(complaintPayload),
  });

  console.log('POST /api/complaints =>', createComplaint.status, createComplaint.payload);

  if (createComplaint.ok && createComplaint.payload?.code) {
    const code = createComplaint.payload.code;
    const detail = await request(`/api/complaints/${code}`);
    console.log('GET /api/complaints/:code =>', detail.status, detail.payload);
  }
}

main().catch((error) => {
  console.error('API TEST FAILED');
  console.error(error);
  process.exitCode = 1;
});
