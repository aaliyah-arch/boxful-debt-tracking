import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { getCases, CaseFilterParams } from './caseService';
import { STAGE_CONFIG } from './stageService';

export async function exportCasesToExcel(params: CaseFilterParams): Promise<Buffer> {
  // Fetch all matching records without pagination
  const result = await getCases({
    ...params,
    page: 1,
    pageSize: 10000,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zealous Debt Collection System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(
    params.businessUnit ? `${params.businessUnit} 欠款清單` : '欠款清單'
  );

  // Define columns
  worksheet.columns = [
    { header: '事業體', key: 'businessUnit', width: 12 },
    { header: '客戶UID', key: 'uid', width: 15 },
    { header: '客戶姓名', key: 'name', width: 16 },
    { header: 'Email', key: 'email', width: 25 },
    { header: '電話', key: 'phone', width: 16 },
    { header: '欠款金額($)', key: 'outstandingAmount', width: 14 },
    { header: '逾期天數', key: 'outstandingDays', width: 12 },
    { header: '當前階段', key: 'stage', width: 20 },
    { header: '是否結案', key: 'isClosed', width: 10 },
    { header: '結案日期', key: 'closedDate', width: 14 },
    { header: '催帳開始日', key: 'collectionStartDate', width: 14 },
    { header: 'Line通知日', key: 'lineNoticeDate', width: 14 },
    { header: 'Line狀態', key: 'lineStatus', width: 14 },
    { header: 'Email通知日', key: 'emailNoticeDate', width: 14 },
    { header: '電話通知日', key: 'phoneNoticeDate', width: 14 },
    { header: '2C催帳備註', key: 'twoCNotes', width: 30 },
    { header: 'FA催告日', key: 'demandNoticeDate', width: 14 },
    { header: 'FA催告到期日', key: 'demandDueDate', width: 14 },
    { header: 'FA催告文件連結', key: 'demandDocUrl', width: 35 },
    { header: 'FA終止函日', key: 'terminationNoticeDate', width: 14 },
    { header: 'FA終止函文件連結', key: 'terminationDocUrl', width: 35 },
    { header: 'FA備註', key: 'faNotes', width: 30 },
  ];

  // Header style
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // slate-800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // Add rows
  for (const item of result.items) {
    const stageName = (STAGE_CONFIG as any)[item.stage]?.name || item.stage;
    const formatDateStr = (d?: Date | null) => (d ? format(new Date(d), 'yyyy-MM-dd') : '');

    worksheet.addRow({
      businessUnit: item.businessUnit,
      uid: item.uid,
      name: item.name,
      email: item.email || '',
      phone: item.phone || '',
      outstandingAmount: item.outstandingAmount,
      outstandingDays: item.outstandingDays,
      stage: item.isClosed ? '5. 已結案' : stageName,
      isClosed: item.isClosed ? '是' : '否',
      closedDate: formatDateStr(item.closedDate),
      collectionStartDate: formatDateStr(item.collectionStartDate),
      lineNoticeDate: formatDateStr(item.lineNoticeDate),
      lineStatus: item.lineStatus || '',
      emailNoticeDate: formatDateStr(item.emailNoticeDate),
      phoneNoticeDate: formatDateStr(item.phoneNoticeDate),
      twoCNotes: item.twoCNotes || '',
      demandNoticeDate: formatDateStr(item.demandNoticeDate),
      demandDueDate: formatDateStr(item.demandDueDate),
      demandDocUrl: item.demandDocUrl || '',
      terminationNoticeDate: formatDateStr(item.terminationNoticeDate),
      terminationDocUrl: item.terminationDocUrl || '',
      faNotes: item.faNotes || '',
    });
  }

  // Format currency column
  worksheet.getColumn('outstandingAmount').numFmt = '$#,##0';
  worksheet.getColumn('outstandingDays').numFmt = '#,##0';

  const uint8Array = await workbook.xlsx.writeBuffer();
  return Buffer.from(uint8Array);
}
