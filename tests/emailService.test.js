const assert = require('node:assert/strict');
const test = require('node:test');
const { buildComplaintReceipt, buildComplaintUpdateEmail } = require('../services/emailService');

function withProductionEnvironment(run) {
  const previous = {
    publicAppUrl: process.env.PUBLIC_APP_URL,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
  };

  delete process.env.PUBLIC_APP_URL;
  process.env.VERCEL_ENV = 'production';
  process.env.VERCEL_URL = 'lapor-omega.vercel.app';

  try {
    run();
  } finally {
    if (previous.publicAppUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previous.publicAppUrl;
    if (previous.vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous.vercelEnv;
    if (previous.vercelUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previous.vercelUrl;
  }
}

test('production complaint email links use the custom domain by default', () => {
  withProductionEnvironment(() => {
    const complaint = { code: 'ADUAN-123', cat: 'Jalan rusak', loc: 'Jl. Merdeka', at: '2026-11-11T00:00:00.000Z' };
    const receipt = buildComplaintReceipt({ complaint, recipientName: 'Warga' });
    const update = buildComplaintUpdateEmail({ complaint, recipientName: 'Warga' });

    assert.match(receipt.htmlContent, /https:\/\/aduan\.badrussholeh\.my\.id\/\?track=ADUAN-123#lacak/);
    assert.match(receipt.textContent, /https:\/\/aduan\.badrussholeh\.my\.id\/\?track=ADUAN-123#lacak/);
    assert.match(update.htmlContent, /https:\/\/aduan\.badrussholeh\.my\.id\/\?track=ADUAN-123#lacak/);
    assert.doesNotMatch(receipt.htmlContent, /lapor-omega\.vercel\.app/);
    assert.doesNotMatch(update.htmlContent, /lapor-omega\.vercel\.app/);
  });
});
