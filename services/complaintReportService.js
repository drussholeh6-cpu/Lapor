const ExcelJS = require('exceljs');

async function createComplaintWorkbook(complaints, filters = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lacak Aduan';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.views = [{ x: 0, y: 0, width: 18000, height: 9000, firstSheet: 0, activeTab: 0 }];

  const worksheet = workbook.addWorksheet('Laporan Aduan', {
    properties: { defaultRowHeight: 22 },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  worksheet.columns = [
    { key: 'code', width: 20 },
    { key: 'date', width: 16 },
    { key: 'region', width: 24 },
    { key: 'location', width: 34 },
    { key: 'category', width: 25 },
    { key: 'status', width: 24 },
    { key: 'priority', width: 16 },
    { key: 'unit', width: 34 },
    { key: 'note', width: 56 },
  ];

  worksheet.mergeCells('A1:I1');
  const title = worksheet.getCell('A1');
  title.value = 'LAPORAN PENGADUAN WARGA';
  title.font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B2A' } };
  worksheet.getRow(1).height = 38;

  worksheet.mergeCells('A2:I2');
  const subtitle = worksheet.getCell('A2');
  const dateRange = [filters.from || 'Semua tanggal', filters.to || 'Sekarang'].join(' s.d. ');
  subtitle.value = `Periode: ${dateRange}  |  Wilayah: ${filters.region && filters.region !== 'all' ? filters.region : 'Semua wilayah'}  |  Dibuat: ${new Date().toLocaleString('id-ID')}`;
  subtitle.font = { name: 'Aptos', size: 10, italic: true, color: { argb: 'FF53665B' } };
  subtitle.alignment = { vertical: 'middle', wrapText: true };
  worksheet.getRow(2).height = 26;

  worksheet.mergeCells('A3:I3');
  const summary = worksheet.getCell('A3');
  summary.value = `Jumlah aduan: ${complaints.length}`;
  summary.font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FF123B2A' } };
  worksheet.getRow(3).height = 24;

  const headers = ['Nomor Aduan', 'Tanggal Masuk', 'Wilayah', 'Lokasi', 'Kategori', 'Status', 'Prioritas', 'Unit Penanggung Jawab', 'Catatan Terakhir'];
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF28734D' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF17452F' } } };
  });

  complaints.forEach((complaint, index) => {
    const lastEntry = complaint.log?.[complaint.log.length - 1];
    const row = worksheet.addRow({
      code: complaint.code,
      date: complaint.at ? new Date(complaint.at) : null,
      region: String(complaint.loc || '').split(',').map((part) => part.trim()).filter(Boolean)[1] || complaint.loc || 'Wilayah tidak disebutkan',
      location: complaint.loc || '',
      category: complaint.cat || '',
      status: lastEntry?.s === -1
        ? 'Ditolak'
        : complaint.waitingForInfo
          ? 'Menunggu informasi warga'
          : ['Diterima', 'Diverifikasi', 'Diproses', 'Selesai'][lastEntry?.s] || 'Diterima',
      priority: ({ urgent: 'Darurat', high: 'Tinggi', normal: 'Normal' })[complaint.priority] || 'Normal',
      unit: complaint.unit || '',
      note: lastEntry?.note || '',
    });
    row.height = 34;
    row.eachCell((cell) => {
      cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF24352B' } };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE5DE' } } };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F7F3' } };
      }
    });
    row.getCell(2).numFmt = 'dd mmm yyyy';
  });

  if (!complaints.length) {
    worksheet.mergeCells('A5:I5');
    worksheet.getCell('A5').value = 'Tidak ada aduan untuk filter yang dipilih.';
    worksheet.getCell('A5').font = { name: 'Aptos', size: 10, italic: true, color: { argb: 'FF53665B' } };
  }

  worksheet.views = [{ state: 'frozen', ySplit: 4, topLeftCell: 'A5', activeCell: 'A5' }];
  worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 9 } };
  worksheet.pageSetup.printTitlesRow = '1:4';
  worksheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };

  return workbook.xlsx.writeBuffer();
}

module.exports = { createComplaintWorkbook };
