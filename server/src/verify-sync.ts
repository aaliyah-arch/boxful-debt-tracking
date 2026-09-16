import prisma from './prisma';
import { parseSpreadsheetBuffer, importReportData } from './services/reportParserService';
import { updateCaseClose, getCases } from './services/caseService';
import * as xlsx from 'xlsx';

async function runVerification() {
  console.log('🚀 開始驗證 OutstandingReport 12 欄位解析與彙整功能...\n');

  // 先清空測試殘留資料以保證乾淨狀態
  await prisma.caseRecord.deleteMany({
    where: { uid: { in: ['TEST-VALET-001', 'TEST-VALET-002'] } },
  });
  await prisma.importHistory.deleteMany({
    where: { fileName: { in: ['Week1_Report.xlsx', 'Week2_Report.xlsx', 'Week3_Report.xlsx'] } },
  });

  // 1. 建立測試用 12 欄位 Excel Buffer
  const week1Data = [
    {
      UID: 'TEST-VALET-001',
      Name: '王大同',
      Email: 'tatung.wang@example.com',
      Phone: '0912-345-678',
      Address: '台北市信義區忠孝東路五段1號',
      'Type of Service': 'Valet Plus',
      'inv Date': '2026-08-01',
      'Inv ID': 'INV-202608-001',
      'Invoiced Amount': 5000,
      'Outstanding Days': 35,
      'Total Outstanding Amount': 5000,
      'Blue Code': 'BC-001',
    },
    // 同一個 UID 第二筆欠款 (欠多個月，金額加總)
    {
      UID: 'TEST-VALET-001',
      Name: '王大同',
      Email: 'tatung.wang@example.com',
      Phone: '0912-345-678',
      Address: '台北市信義區忠孝東路五段1號',
      'Type of Service': 'Valet Plus',
      'inv Date': '2026-07-01',
      'Inv ID': 'INV-202607-001',
      'Invoiced Amount': 6000,
      'Outstanding Days': 65,
      'Total Outstanding Amount': 6000,
      'Blue Code': 'BC-001',
    },
    // 第二個客戶 (下週會付款消失)
    {
      UID: 'TEST-VALET-002',
      Name: '陳美美',
      Email: 'meimei.chen@example.com',
      Phone: '0988-111-222',
      Address: '新北市板橋區文化路一段10號',
      'Type of Service': 'Standard',
      'inv Date': '2026-07-15',
      'Inv ID': 'INV-202607-088',
      'Invoiced Amount': 8000,
      'Outstanding Days': 50,
      'Total Outstanding Amount': 8000,
      'Blue Code': 'BC-002',
    },
  ];

  const ws1 = xlsx.utils.json_to_sheet(week1Data);
  const wb1 = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb1, ws1, 'Week1');
  const week1Buffer = xlsx.write(wb1, { type: 'buffer', bookType: 'xlsx' });

  // 測試解析與彙整
  const { rawRows, aggregatedMap } = parseSpreadsheetBuffer(week1Buffer);
  console.log(`✓ 原始解析筆數: ${rawRows.length} (預期 3)`);
  console.log(`✓ 彙整後客戶數: ${aggregatedMap.size} (預期 2)`);

  const cust1 = aggregatedMap.get('TEST-VALET-001');
  if (!cust1) throw new Error('未能找到 TEST-VALET-001 彙整資料');
  console.log(`✓ TEST-VALET-001 總欠款金額加總: $${cust1.totalOutstandingAmount} (預期 5000 + 6000 = 11000)`);
  console.log(`✓ TEST-VALET-001 最大逾期天數: ${cust1.outstandingDays} 天 (預期 65)`);
  console.log(`✓ TEST-VALET-001 服務類型: ${cust1.serviceType}, 地址: ${cust1.address}`);

  if (cust1.totalOutstandingAmount !== 11000 || cust1.outstandingDays !== 65) {
    throw new Error('加總金額或最大逾期天數計算不符！');
  }

  // 2. 測試匯入第一週
  console.log('\n--- 測試匯入第 1 週報表 ---');
  const res1 = await importReportData('VALET', 'Week1_Report.xlsx', week1Buffer, 'Tester');
  console.log(`✓ 匯入成功：新增 ${res1.newCount} 筆，更新 ${res1.updatedCount} 筆`);

  // 3. 測試匯入第二週（TEST-VALET-002 已繳款，不在名單中）
  console.log('\n--- 測試匯入第 2 週報表 (TEST-VALET-002 繳款消失) ---');
  const week2Data = [
    {
      UID: 'TEST-VALET-001',
      Name: '王大同',
      Email: 'tatung.wang@example.com',
      Phone: '0912-345-678',
      Address: '台北市信義區忠孝東路五段1號',
      'Type of Service': 'Valet Plus',
      'inv Date': '2026-08-01',
      'Inv ID': 'INV-202608-001',
      'Invoiced Amount': 11000,
      'Outstanding Days': 42,
      'Total Outstanding Amount': 11000,
      'Blue Code': 'BC-001',
    },
  ];
  const ws2 = xlsx.utils.json_to_sheet(week2Data);
  const wb2 = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb2, ws2, 'Week2');
  const week2Buffer = xlsx.write(wb2, { type: 'buffer', bookType: 'xlsx' });

  const res2 = await importReportData('VALET', 'Week2_Report.xlsx', week2Buffer, 'Tester');
  console.log(`✓ 第 2 週匯入成功：更新 ${res2.updatedCount} 筆，轉為待確認結案: ${res2.pendingConfirmationCount} 筆`);

  const case2 = await prisma.caseRecord.findFirst({
    where: { businessUnit: 'VALET', uid: 'TEST-VALET-002', isClosed: false },
  });
  console.log(`✓ TEST-VALET-002 狀態標記: ${case2?.statusTag} (預期 PENDING_CONFIRMATION)`);
  if (case2?.statusTag !== 'PENDING_CONFIRMATION') {
    throw new Error('未出現在新名單的客戶未能正確轉為 PENDING_CONFIRMATION！');
  }

  // 4. 測試 2C team 確認結案
  console.log('\n--- 測試 2C team 確認結案 TEST-VALET-002 ---');
  if (case2) {
    const closed = await updateCaseClose(case2.id, { isClosed: true }, 'test-admin');
    console.log(`✓ TEST-VALET-002 已結案，stage: ${closed.stage}, isClosed: ${closed.isClosed}`);
  }

  // 5. 測試重複欠款客人（先前已結案，又再次欠款）
  console.log('\n--- 測試重複欠款客人 (已結案者第 3 週再次欠款) ---');
  const week3Data = [
    {
      UID: 'TEST-VALET-002',
      Name: '陳美美',
      Email: 'meimei.chen@example.com',
      Phone: '0988-111-222',
      Address: '新北市板橋區文化路一段10號',
      'Type of Service': 'Standard',
      'inv Date': '2026-09-01',
      'Inv ID': 'INV-202609-001',
      'Invoiced Amount': 3000,
      'Outstanding Days': 32,
      'Total Outstanding Amount': 3000,
      'Blue Code': 'BC-002',
    },
  ];
  const ws3 = xlsx.utils.json_to_sheet(week3Data);
  const wb3 = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb3, ws3, 'Week3');
  const week3Buffer = xlsx.write(wb3, { type: 'buffer', bookType: 'xlsx' });

  const res3 = await importReportData('VALET', 'Week3_Report.xlsx', week3Buffer, 'Tester');
  console.log(`✓ 第 3 週匯入成功：新增新案件 ${res3.newCount} 筆 (不覆蓋舊結案紀錄)`);

  const allRecords = await prisma.caseRecord.findMany({
    where: { businessUnit: 'VALET', uid: 'TEST-VALET-002' },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`✓ TEST-VALET-002 在資料庫中總共有 ${allRecords.length} 筆案件 (預期 2 筆: 1 筆已結案 + 1 筆新未結案)`);
  console.log(`  - 第 1 筆: isClosed = ${allRecords[0].isClosed} (已結案歷史紀錄保留)`);
  console.log(`  - 第 2 筆: isClosed = ${allRecords[1].isClosed}, amount = $${allRecords[1].outstandingAmount} (追蹤中的新案件)`);

  if (allRecords.length !== 2 || !allRecords[0].isClosed || allRecords[1].isClosed) {
    throw new Error('重複欠款處理不符：未能完整保留結案歷史紀錄並追蹤新案件！');
  }

  // 清理測試資料
  await prisma.caseRecord.deleteMany({
    where: { uid: { in: ['TEST-VALET-001', 'TEST-VALET-002'] } },
  });
  await prisma.importHistory.deleteMany({
    where: { fileName: { in: ['Week1_Report.xlsx', 'Week2_Report.xlsx', 'Week3_Report.xlsx'] } },
  });

  console.log('\n🎉 所有核心邏輯驗證全部通過！');
}

runVerification()
  .catch((e) => {
    console.error('❌ 驗證失敗:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
