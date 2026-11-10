const BREVO_EMAIL_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const PRODUCTION_APP_URL = 'https://aduan.badrussholeh.my.id';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function getEmailConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.SMTP_FROM_EMAIL?.trim();
  if (!apiKey || !senderEmail) {
    throw new Error('BREVO_API_KEY and SMTP_FROM_EMAIL must be configured.');
  }

  return {
    apiKey,
    senderEmail,
    senderName: process.env.SMTP_FROM_NAME?.trim() || 'Lacak Aduan',
  };
}

function getPublicAppUrl() {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const value = configuredUrl
    || (process.env.VERCEL_ENV === 'production' ? PRODUCTION_APP_URL : '')
    || (vercelUrl ? `https://${vercelUrl}` : '');
  if (!value) throw new Error('PUBLIC_APP_URL must be configured.');

  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('PUBLIC_APP_URL must use HTTPS.');
  }

  return url.origin;
}

function assertConfigured() {
  const config = getEmailConfig();
  getPublicAppUrl();
  return config;
}

function buildComplaintReceipt({ complaint, recipientName }) {
  const name = recipientName?.trim() || 'Warga';
  const code = String(complaint.code || '');
  const category = String(complaint.cat || '');
  const location = String(complaint.loc || '');
  const createdAt = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(complaint.at));
  const appUrl = getPublicAppUrl();
  const trackingLink = appUrl
    ? `<a href="${escapeHtml(`${appUrl}/?track=${encodeURIComponent(code)}#lacak`)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Lacak perkembangan aduan&nbsp; &rarr;</a>`
    : '';
  const trackingInstruction = appUrl
    ? 'Klik tombol lacak untuk melihat resi dan perkembangan aduan Anda secara langsung.'
    : 'Buka situs Lacak Aduan dan masukkan nomor di atas untuk melihat perkembangannya.';

  const htmlContent = `<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Aduan ${escapeHtml(code)} sudah kami terima. Simpan nomor ini untuk memantau tindak lanjutnya.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:34px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:30px 36px;background:#0f172a;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" width="38" height="38" style="width:38px;height:38px;border-radius:8px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:800;">LA</td>
            <td style="padding-left:11px;color:#ffffff;font-size:15px;font-weight:700;">Lacak Aduan</td>
          </tr></table>
          <p style="margin:26px 0 9px;color:#bfdbfe;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Konfirmasi pengaduan</p>
          <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;font-weight:700;">Aduan Anda telah<br>kami terima.</h1>
          <p style="margin:12px 0 0;color:#cbd5e1;font-size:14px;line-height:1.7;">Terima kasih telah membantu menyampaikan hal yang perlu diperhatikan di lingkungan kita.</p>
        </td></tr>
        <tr><td style="padding:30px 36px 34px;">
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0;color:#475569;font-size:13px;line-height:1.7;">Laporan Anda sudah tercatat di sistem. Simpan nomor aduan di bawah ini untuk memantau proses penanganan.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:23px 0;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 8px;color:#64748b;font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Nomor aduan Anda</p>
              <p style="margin:0;color:#0f172a;font-family:Consolas,'Courier New',monospace;font-size:25px;font-weight:700;letter-spacing:.5px;">${escapeHtml(code)}</p>
              <p style="margin:8px 0 0;color:#475569;font-size:12px;line-height:1.6;">Status awal <strong style="color:#1d4ed8;">Diterima</strong></p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:22px;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;">Jenis aduan</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:12px;font-weight:700;">${escapeHtml(category)}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;">Lokasi</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:12px;font-weight:700;">${escapeHtml(location)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:12px;">Tanggal dikirim</td><td align="right" style="padding:8px 0;color:#0f172a;font-size:12px;font-weight:700;">${escapeHtml(createdAt)}</td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;border-left:3px solid #2563eb;background:#f8fafc;">
            <tr><td style="padding:12px 14px;color:#334155;font-size:12px;line-height:1.7;">${escapeHtml(trackingInstruction)}</td></tr>
          </table>
          ${trackingLink ? `<p style="margin:0 0 24px;">${trackingLink}</p>` : ''}
          <p style="margin:0;color:#475569;font-size:12px;line-height:1.7;">Petugas akan meninjau laporan dan meneruskannya ke unit terkait. Simpan email ini sebagai bukti pengiriman.</p>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#64748b;font-size:10px;line-height:1.7;">Email ini dikirim otomatis oleh <strong style="color:#334155;">Lacak Aduan</strong>. Mohon tidak membalas email ini. Identitas dan alamat email Anda tidak ditampilkan di papan publik.</p>
        </td></tr>
      </table>
      <p style="margin:15px 0 0;color:#64748b;font-size:10px;line-height:1.6;">Lacak Aduan &middot; Kelurahan Sukamaju</p>
    </td></tr>
  </table>
</body>
</html>`;

  const textContent = [
    `Halo ${name},`,
    '',
    'Aduan Anda telah kami terima.',
    `Nomor aduan: ${code}`,
    'Status: Diterima',
    `Jenis aduan: ${category}`,
    `Lokasi: ${location}`,
    `Tanggal dikirim: ${createdAt}`,
    '',
    trackingInstruction,
    trackingLink ? `Lacak perkembangan aduan: ${appUrl}/?track=${encodeURIComponent(code)}#lacak` : '',
    '',
    'Simpan email ini sebagai bukti pengiriman.',
    'Email ini dikirim otomatis oleh Lacak Aduan.',
  ].filter(Boolean).join('\n');

  return {
    subject: `Aduan ${code} telah kami terima`,
    htmlContent,
    textContent,
  };
}

function buildComplaintUpdateEmail({ complaint, recipientName }) {
  const name = recipientName?.trim() || 'Warga';
  const code = String(complaint.code || '');
  const appUrl = getPublicAppUrl();
  const trackingUrl = `${appUrl}/?track=${encodeURIComponent(code)}#lacak`;
  const latestEntry = complaint.log?.[complaint.log.length - 1];
  const waitingForInfo = Boolean(complaint.waitingForInfo);
  const status = waitingForInfo
    ? 'Informasi tambahan dibutuhkan'
    : latestEntry?.s === -1
      ? 'Ditolak'
      : ['Diterima', 'Diverifikasi', 'Diproses', 'Selesai'][latestEntry?.s] || 'Diperbarui';
  const publicNote = waitingForInfo
    ? String(complaint.infoPrompt || '')
    : latestEntry?.visibility !== 'internal'
      ? String(latestEntry?.note || '')
      : '';
  const subject = waitingForInfo
    ? `Informasi tambahan diperlukan untuk aduan ${code}`
    : `Perkembangan aduan ${code}: ${status}`;
  const details = publicNote
    ? `<p style="margin:18px 0 0;padding:14px;border-left:3px solid #2563eb;background:#f8fafc;color:#334155;font-size:13px;line-height:1.7;"><b>${waitingForInfo ? 'Informasi' : 'Catatan petugas'}:</b><br>${escapeHtml(publicNote)}</p>`
    : '';
  const htmlContent = `<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:30px 14px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <main style="max-width:560px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
    <p style="margin:0 0 8px;color:#2563eb;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Pembaruan Lacak Aduan</p>
    <h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;">Perkembangan aduan Anda</h1>
    <p style="font-size:14px;line-height:1.7;">Halo <b>${escapeHtml(name)}</b>, status aduan <b>${escapeHtml(code)}</b> sekarang: <b>${escapeHtml(status)}</b>.</p>
    ${details}
    <p style="margin:24px 0;"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Lihat resi dan perkembangan aduan</a></p>
    <p style="margin:0;color:#64748b;font-size:11px;line-height:1.7;">Email otomatis dari Lacak Aduan. Anda dapat membuka tautan di atas tanpa login.</p>
  </main>
</body>
</html>`;
  const textContent = [
    `Halo ${name},`,
    '',
    `Status aduan ${code} sekarang: ${status}.`,
    publicNote ? `${waitingForInfo ? 'Informasi' : 'Catatan petugas'}: ${publicNote}` : '',
    '',
    `Lihat resi dan perkembangan aduan: ${trackingUrl}`,
    '',
    'Email otomatis dari Lacak Aduan.',
  ].filter(Boolean).join('\n');

  return { subject, htmlContent, textContent };
}

async function deliverEmail({ email, recipientEmail, recipientName }) {
  const { apiKey, senderEmail, senderName } = assertConfigured();
  const response = await fetch(BREVO_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ name: recipientName?.trim() || 'Warga', email: recipientEmail }],
      subject: email.subject,
      htmlContent: email.htmlContent,
      textContent: email.textContent,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    let responseMessage = '';
    try {
      const body = await response.json();
      responseMessage = body.message || body.code || '';
    } catch {
      responseMessage = '';
    }

    throw new Error(`Brevo rejected the email (HTTP ${response.status}${responseMessage ? `: ${responseMessage}` : ''}).`);
  }
}

async function sendComplaintReceipt({ complaint, recipientEmail, recipientName }) {
  await deliverEmail({
    email: buildComplaintReceipt({ complaint, recipientName }),
    recipientEmail,
    recipientName,
  });
}

async function sendComplaintUpdate({ complaint, recipientEmail, recipientName }) {
  await deliverEmail({
    email: buildComplaintUpdateEmail({ complaint, recipientName }),
    recipientEmail,
    recipientName,
  });
}

module.exports = {
  assertConfigured,
  buildComplaintReceipt,
  buildComplaintUpdateEmail,
  sendComplaintReceipt,
  sendComplaintUpdate,
};
