const BREVO_EMAIL_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

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
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  if (!apiKey || !senderEmail) {
    throw new Error('BREVO_API_KEY and BREVO_SENDER_EMAIL must be configured.');
  }

  return {
    apiKey,
    senderEmail,
    senderName: process.env.BREVO_SENDER_NAME?.trim() || 'Lacak Aduan',
  };
}

function getPublicAppUrl() {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const value = configuredUrl || (vercelUrl ? `https://${vercelUrl}` : '');
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
    ? `<a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#d8f36b;color:#0b1f17;text-decoration:none;font-size:14px;font-weight:700;">Lacak perkembangan aduan&nbsp; &rarr;</a>`
    : '';
  const trackingInstruction = appUrl
    ? 'Buka Lacak Aduan dan masukkan nomor di atas untuk melihat perkembangannya.'
    : 'Buka situs Lacak Aduan dan masukkan nomor di atas untuk melihat perkembangannya.';

  const htmlContent = `<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f2f4ef;font-family:Arial,Helvetica,sans-serif;color:#14231c;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Aduan ${escapeHtml(code)} sudah kami terima. Simpan nomor ini untuk memantau tindak lanjutnya.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2f4ef;">
    <tr><td align="center" style="padding:34px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e9e1;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:32px 36px;background:#0b1f17;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" width="38" height="38" style="width:38px;height:38px;border-radius:12px;background:#d8f36b;color:#0b1f17;font-size:15px;font-weight:800;">LA</td>
            <td style="padding-left:11px;color:#ffffff;font-size:15px;font-weight:700;">Lacak Aduan</td>
          </tr></table>
          <p style="margin:29px 0 9px;color:#d8f36b;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Konfirmasi pengaduan</p>
          <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;font-weight:700;">Aduan Anda telah<br>kami terima.</h1>
          <p style="margin:12px 0 0;color:#c5d0c8;font-size:14px;line-height:1.7;">Terima kasih telah membantu menyampaikan hal yang perlu diperhatikan di lingkungan kita.</p>
        </td></tr>
        <tr><td style="padding:30px 36px 34px;">
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0;color:#637168;font-size:13px;line-height:1.7;">Laporan Anda sudah tercatat di sistem. Simpan nomor aduan di bawah ini untuk memantau proses penanganan.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:23px 0;border:1px solid #e4e9e1;border-radius:14px;background:#f7f9f5;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 8px;color:#718075;font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Nomor aduan Anda</p>
              <p style="margin:0;color:#0b1f17;font-family:Consolas,'Courier New',monospace;font-size:25px;font-weight:700;letter-spacing:.5px;">${escapeHtml(code)}</p>
              <p style="margin:8px 0 0;color:#637168;font-size:12px;line-height:1.6;">Status awal <strong style="color:#17734f;">Diterima</strong></p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:22px;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #edf0eb;color:#718075;font-size:12px;">Jenis aduan</td><td align="right" style="padding:8px 0;border-bottom:1px solid #edf0eb;color:#26382d;font-size:12px;font-weight:700;">${escapeHtml(category)}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #edf0eb;color:#718075;font-size:12px;">Lokasi</td><td align="right" style="padding:8px 0;border-bottom:1px solid #edf0eb;color:#26382d;font-size:12px;font-weight:700;">${escapeHtml(location)}</td></tr>
            <tr><td style="padding:8px 0;color:#718075;font-size:12px;">Tanggal dikirim</td><td align="right" style="padding:8px 0;color:#26382d;font-size:12px;font-weight:700;">${escapeHtml(createdAt)}</td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;border-left:3px solid #d8f36b;background:#f7f9f5;">
            <tr><td style="padding:12px 14px;color:#536258;font-size:12px;line-height:1.7;">${escapeHtml(trackingInstruction)}</td></tr>
          </table>
          ${trackingLink ? `<p style="margin:0 0 24px;">${trackingLink}</p>` : ''}
          <p style="margin:0;color:#637168;font-size:12px;line-height:1.7;">Petugas akan meninjau laporan dan meneruskannya ke unit terkait. Simpan email ini sebagai bukti pengiriman.</p>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#f7f9f5;border-top:1px solid #edf0eb;">
          <p style="margin:0;color:#718075;font-size:10px;line-height:1.7;">Email ini dikirim otomatis oleh <strong>Lacak Aduan</strong>. Mohon tidak membalas email ini. Identitas dan alamat email Anda tidak ditampilkan di papan publik.</p>
        </td></tr>
      </table>
      <p style="margin:15px 0 0;color:#8b968e;font-size:10px;line-height:1.6;">Lacak Aduan &middot; Kelurahan Sukamaju</p>
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
    appUrl ? appUrl : '',
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

async function sendComplaintReceipt({ complaint, recipientEmail, recipientName }) {
  const { apiKey, senderEmail, senderName } = assertConfigured();
  const email = buildComplaintReceipt({ complaint, recipientName });
  const response = await fetch(BREVO_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: recipientEmail, name: recipientName?.trim() || 'Warga' }],
      subject: email.subject,
      htmlContent: email.htmlContent,
      textContent: email.textContent,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Brevo rejected the confirmation email (HTTP ${response.status}).`);
  }
}

module.exports = {
  assertConfigured,
  buildComplaintReceipt,
  sendComplaintReceipt,
};
