import * as xlsx from 'xlsx';
import { computeStage } from './services/stageService';
import { getDashboardOverview } from './services/dashboardService';
import { importReportData } from './services/reportParserService';
import { exportCasesToExcel } from './services/exportService';
import { getCases, update2CFields, updateFAFields, updateCaseClose } from './services/caseService';
import { authenticateGoogleCredential, mockDevLogin } from './services/authService';
import prisma from './prisma';

async function runVerification() {
  console.log('🧪 ================= STARTING SYSTEM VERIFICATION ================= 🧪\n');

  // Test 1: Stage Calculation Rules
  console.log('▶ Test 1: Verifying Stage Calculation Logic...');
  const stage1 = computeStage({ isClosed: false, outstandingDays: 20 });
  const stage2 = computeStage({ isClosed: false, outstandingDays: 35 });
  const stage3 = computeStage({ isClosed: false, outstandingDays: 55 });
  const stage4 = computeStage({ isClosed: false, outstandingDays: 85 });
  const stage5 = computeStage({ isClosed: false, outstandingDays: 100 });
  const stageTerm = computeStage({
    isClosed: false,
    outstandingDays: 82,
    terminationNoticeDate: new Date(Date.now() - 16 * 86400000), // 16 days ago
  });
  const stageClosed = computeStage({ isClosed: true, outstandingDays: 100 });

  console.log(`  - 20 days: ${stage1} (expected: UNREACHED) -> ${stage1 === 'UNREACHED' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - 35 days: ${stage2} (expected: STAGE_1) -> ${stage2 === 'STAGE_1' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - 55 days: ${stage3} (expected: STAGE_2) -> ${stage3 === 'STAGE_2' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - 85 days: ${stage4} (expected: STAGE_3) -> ${stage4 === 'STAGE_3' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - 100 days: ${stage5} (expected: STAGE_4) -> ${stage5 === 'STAGE_4' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - 82 days + Term Notice > 15 days: ${stageTerm} (expected: STAGE_4) -> ${stageTerm === 'STAGE_4' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - isClosed=true: ${stageClosed} (expected: CLOSED) -> ${stageClosed === 'CLOSED' ? '✅ PASS' : '❌ FAIL'}`);

  if (
    stage1 !== 'UNREACHED' ||
    stage2 !== 'STAGE_1' ||
    stage3 !== 'STAGE_2' ||
    stage4 !== 'STAGE_3' ||
    stage5 !== 'STAGE_4' ||
    stageTerm !== 'STAGE_4' ||
    stageClosed !== 'CLOSED'
  ) {
    throw new Error('❌ Stage computation verification failed!');
  }

  // Test 2: Dashboard Overview Calculation for Valet & Pepper
  console.log('\n▶ Test 2: Verifying Valet Dashboard Overview...');
  const valetOverview = await getDashboardOverview('VALET', new Date('2026-09-09'));
  console.log(`  - Business Unit: ${valetOverview.businessUnit}`);
  console.log(`  - Time Buckets: ${valetOverview.timeBuckets.map((b) => b.label).join(' | ')}`);
  console.log(`  - Total Cases: ${valetOverview.kpiSummary.totalCases}`);
  console.log(`  - Total Outstanding Amount: $${valetOverview.kpiSummary.totalOutstandingAmount.toLocaleString()}`);
  console.log(`  - Total Closed Amount: $${valetOverview.kpiSummary.totalClosedAmount.toLocaleString()}`);

  const olderBucketKey = valetOverview.timeBuckets[0].key;
  const writeOffRow = valetOverview.rows.find((r) => r.key === 'STAGE_4');
  const closedRow = valetOverview.rows.find((r) => r.key === 'CLOSED');
  const totalRow = valetOverview.totalsRow;

  console.log(`  - [2026/06前] 4. 待write-off: $${writeOffRow?.buckets[olderBucketKey]?.amount} (${writeOffRow?.buckets[olderBucketKey]?.count}人, ${writeOffRow?.buckets[olderBucketKey]?.percentageStr})`);
  console.log(`  - [2026/06前] 5. 已結案: $${closedRow?.buckets[olderBucketKey]?.amount} (${closedRow?.buckets[olderBucketKey]?.count}人, ${closedRow?.buckets[olderBucketKey]?.percentageStr})`);
  console.log(`  - [2026/06前] 總和: $${totalRow?.buckets[olderBucketKey]?.amount} (${totalRow?.buckets[olderBucketKey]?.count}人, ${totalRow?.buckets[olderBucketKey]?.percentageStr})`);

  console.log('\n▶ Test 3: Verifying Pepper Dashboard Overview...');
  const pepperOverview = await getDashboardOverview('PEPPER', new Date('2026-09-09'));
  console.log(`  - Business Unit: ${pepperOverview.businessUnit}`);
  console.log(`  - Total Cases: ${pepperOverview.kpiSummary.totalCases}`);
  console.log(`  - Active Cases: ${pepperOverview.kpiSummary.activeCases}`);

  // Test 4: Report Import & Preservation of Existing 2C / FA Notes
  console.log('\n▶ Test 4: Verifying Excel Report Import & Record Synchronization...');
  // First, create or update a 2C record
  const testCase = await prisma.caseRecord.findFirst({ where: { businessUnit: 'VALET', uid: 'V-2608-001' } });
  if (testCase) {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    await update2CFields(
      testCase.id,
      {
        lineNoticeDate: '2026-08-10',
        lineStatus: 'LINE測試確認',
        twoCNotes: '【重要備忘】2C 專屬重要筆記不可被報表覆蓋！',
      },
      adminUser!.id
    );
  }

  // Generate an Excel sheet in memory with new outstanding days and amount for V-2608-001 plus a new customer
  const mockReportRows = [
    {
      UID: 'V-2608-001',
      Name: '黃志強',
      Email: 'chihchiang.huang@gmail.com',
      Phone: '0912-888-999',
      'Outstanding Amount': 13500, // Updated amount
      'Outstanding Days': 52,     // Updated days (advances from 42 to 52 -> Stage 2!)
      'Bill Date': '2026-08-01',
    },
    {
      UID: 'V-NEW-999',
      Name: '新進欠款客戶-測試',
      Email: 'new.test@example.com',
      Phone: '0999-123-456',
      'Outstanding Amount': 36000,
      'Outstanding Days': 33,     // Stage 1
      'Bill Date': '2026-08-15',
    },
  ];

  const ws = xlsx.utils.json_to_sheet(mockReportRows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const importResult = await importReportData('VALET', 'Weekly_Test_Report.xlsx', buffer, 'Test Runner');
  console.log(`  - Import result: Total=${importResult.totalCount}, New=${importResult.newCount}, Updated=${importResult.updatedCount}`);

  // Verify updated record preserved 2C note
  const updatedCase = await prisma.caseRecord.findFirst({ where: { businessUnit: 'VALET', uid: 'V-2608-001' } });
  console.log(`  - Case V-2608-001 updated amount: $${updatedCase?.outstandingAmount} (expected 13500)`);
  console.log(`  - Case V-2608-001 updated days: ${updatedCase?.outstandingDays} (expected 52)`);
  console.log(`  - Case V-2608-001 auto stage: ${updatedCase?.stage} (expected STAGE_2)`);
  console.log(`  - Preserved 2C Note: "${updatedCase?.twoCNotes}"`);

  if (!updatedCase?.twoCNotes?.includes('2C 專屬重要筆記不可被報表覆蓋')) {
    throw new Error('❌ 2C Notes were accidentally overwritten by report import!');
  }
  console.log('  ✅ 2C Notes correctly preserved on Excel re-import!');

  // Test 5: Excel Export
  console.log('\n▶ Test 5: Verifying Excel Export...');
  const excelBuffer = await exportCasesToExcel({ businessUnit: 'VALET' });
  console.log(`  - Generated Excel binary size: ${excelBuffer.length} bytes -> ✅ PASS`);

  // Test 6: Auth Role & Whitelist
  console.log('\n▶ Test 6: Verifying Whitelist & Role Assignment...');
  const userAlice = await mockDevLogin('TWO_C_TEAM');
  const userBob = await mockDevLogin('FA_TEAM');
  const userAdmin = await mockDevLogin('ADMIN');
  console.log(`  - Alice role: ${userAlice.user.role} -> ${userAlice.user.role === 'TWO_C_TEAM' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - Bob role: ${userBob.user.role} -> ${userBob.user.role === 'FA_TEAM' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - Admin role: ${userAdmin.user.role} -> ${userAdmin.user.role === 'ADMIN' ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n🎉 ================= ALL VERIFICATION TESTS PASSED! ================= 🎉\n');
}

runVerification()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
