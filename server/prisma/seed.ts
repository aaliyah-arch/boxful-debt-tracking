import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.caseRecord.deleteMany();
  await prisma.importHistory.deleteMany();
  await prisma.whitelistConfig.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Whitelist Entries
  const whitelistUsers = [
    { email: '2c.team@company.com', role: 'TWO_C_TEAM', note: '2C 客服催款組專員' },
    { email: '2c.specialist@company.com', role: 'TWO_C_TEAM', note: '2C 催款專員 Alice' },
    { email: 'fa.team@company.com', role: 'FA_TEAM', note: 'FA 財務法務組' },
    { email: 'fa.specialist@company.com', role: 'FA_TEAM', note: 'FA 法務專員 Bob' },
    { email: 'admin@company.com', role: 'ADMIN', note: '系統最高管理員' },
  ];

  for (const u of whitelistUsers) {
    await prisma.whitelistConfig.create({
      data: u,
    });
  }

  // 3. Create Demo Users
  const users = [
    { email: '2c.specialist@company.com', name: '2C 專員 (Alice)', role: 'TWO_C_TEAM' },
    { email: 'fa.specialist@company.com', name: 'FA 專員 (Bob)', role: 'FA_TEAM' },
    { email: 'admin@company.com', name: '系統主管 (Admin)', role: 'ADMIN' },
  ];

  for (const u of users) {
    await prisma.user.create({
      data: u,
    });
  }

  console.log('✅ Whitelist and users seeded.');

  // 4. Seed Valet Cases
  // Matching the user's reference image for 2026/06前 (Valet):
  // 待write-off: 10 people, $60,890
  // 已結案: 637 people, $1,696,187
  // Total: 647 people, $1,757,077

  const valetOlderWriteOffAmounts = [6089, 6089, 6089, 6089, 6089, 6089, 6089, 6089, 6089, 6089]; // 10 people = 60,890
  for (let i = 0; i < valetOlderWriteOffAmounts.length; i++) {
    await prisma.caseRecord.create({
      data: {
        uid: `V-HIST-WO-${String(i + 1).padStart(3, '0')}`,
        name: `歷史欠款戶-W${i + 1}`,
        email: `hist.wo.${i + 1}@example.com`,
        phone: `0910-000-${String(100 + i)}`,
        businessUnit: 'VALET',
        outstandingAmount: valetOlderWriteOffAmounts[i],
        outstandingDays: 120 + i * 5,
        billDate: new Date('2026-04-10'),
        collectionStartDate: new Date('2026-05-15'),
        stage: 'STAGE_4',
        isClosed: false,
        demandNoticeDate: new Date('2026-06-01'),
        demandDueDate: new Date('2026-06-15'),
        demandDocUrl: 'https://docs.google.com/document/d/1demo-demand-doc-hist-wo',
        terminationNoticeDate: new Date('2026-07-01'),
        terminationDocUrl: 'https://docs.google.com/document/d/1demo-termination-doc-hist-wo',
        faNotes: '終止函滿15天未結案，進入待write-off階段',
      },
    });
  }

  // To simulate 637 closed historical cases without bloating the DB too much,
  // we create representative batches totaling $1,696,187 and 637 count using a few records, or create a realistic batch
  // Let's create realistic cases for Valet and Pepper
  const avgClosedAmt = 1696187 / 637; // ~2662.77
  for (let i = 0; i < 20; i++) {
    const isBig = i === 0;
    const countRepresented = isBig ? 618 : 1;
    const amt = isBig ? Math.round(avgClosedAmt * 618 * 100) / 100 : Math.round(avgClosedAmt * 100) / 100;

    await prisma.caseRecord.create({
      data: {
        uid: `V-HIST-CL-${String(i + 1).padStart(3, '0')}`,
        name: isBig ? `歷史結案批次 (共618筆)` : `歷史結案客戶-${i + 1}`,
        email: `hist.closed.${i + 1}@example.com`,
        phone: `0911-000-${String(200 + i)}`,
        businessUnit: 'VALET',
        outstandingAmount: amt,
        outstandingDays: 45 + i,
        billDate: new Date('2026-03-20'),
        collectionStartDate: new Date('2026-04-20'),
        stage: 'CLOSED',
        isClosed: true,
        closedDate: new Date('2026-05-30'),
        lineNoticeDate: new Date('2026-04-22'),
        lineStatus: '已繳清',
        twoCNotes: '已全額結案入帳',
      },
    });
  }

  // Active Valet Cases in recent months (2026/07, 2026/08, 2026/09)
  const recentValetCases = [
    // 2026/07
    {
      uid: 'V-2607-001',
      name: '陳國華',
      email: 'guohua.chen@gmail.com',
      phone: '0928-111-222',
      outstandingAmount: 18500,
      outstandingDays: 68,
      billDate: new Date('2026-07-02'),
      collectionStartDate: new Date('2026-07-10'),
      stage: 'STAGE_2',
      lineNoticeDate: new Date('2026-07-12'),
      lineStatus: '已讀未回',
      emailNoticeDate: new Date('2026-07-18'),
      phoneNoticeDate: new Date('2026-07-25'),
      phoneStatus: '承諾7月底繳款，逾期未繳',
      demandNoticeDate: new Date('2026-08-20'),
      demandDueDate: new Date('2026-09-05'),
      demandDocUrl: 'https://docs.google.com/document/d/1valet-demand-chen',
      twoCNotes: '客戶電話中態度消極，轉交 FA 進行第二階段催告',
      faNotes: '已寄送存證信函/催告函，待到期日追蹤',
    },
    {
      uid: 'V-2607-002',
      name: '林雅慧',
      email: 'yahui.lin@yahoo.com.tw',
      phone: '0935-333-444',
      outstandingAmount: 45000,
      outstandingDays: 88,
      billDate: new Date('2026-07-05'),
      collectionStartDate: new Date('2026-07-15'),
      stage: 'STAGE_3',
      lineNoticeDate: new Date('2026-07-16'),
      demandNoticeDate: new Date('2026-08-25'),
      demandDueDate: new Date('2026-09-08'),
      demandDocUrl: 'https://docs.google.com/document/d/1valet-demand-lin',
      terminationNoticeDate: new Date('2026-09-02'),
      terminationDocUrl: 'https://docs.google.com/document/d/1valet-term-lin',
      twoCNotes: 'Line封鎖，電話空號',
      faNotes: '滿80天發送終止函，等待15天期滿',
    },
    // 2026/08
    {
      uid: 'V-2608-001',
      name: '黃志強',
      email: 'chihchiang.huang@gmail.com',
      phone: '0912-888-999',
      outstandingAmount: 12000,
      outstandingDays: 42,
      billDate: new Date('2026-08-01'),
      collectionStartDate: new Date('2026-08-10'),
      stage: 'STAGE_1',
      lineNoticeDate: new Date('2026-08-10'),
      lineStatus: '已回覆會於發薪日繳納',
      twoCNotes: '預計9/15補繳，持續觀察',
    },
    {
      uid: 'V-2608-002',
      name: '張淑芬',
      email: 'shufen.chang@outlook.com',
      phone: '0958-666-777',
      outstandingAmount: 23400,
      outstandingDays: 52,
      billDate: new Date('2026-08-03'),
      collectionStartDate: new Date('2026-08-12'),
      stage: 'STAGE_2',
      lineNoticeDate: new Date('2026-08-12'),
      demandNoticeDate: new Date('2026-09-01'),
      demandDueDate: new Date('2026-09-15'),
      demandDocUrl: 'https://docs.google.com/document/d/1valet-demand-chang',
      twoCNotes: '多次未接聽',
      faNotes: '已發出催告通知',
    },
    // 2026/09
    {
      uid: 'V-2609-001',
      name: '周建明',
      email: 'chienming.chou@gmail.com',
      phone: '0972-555-666',
      outstandingAmount: 8800,
      outstandingDays: 32,
      billDate: new Date('2026-09-01'),
      collectionStartDate: new Date('2026-09-05'),
      stage: 'STAGE_1',
      lineNoticeDate: new Date('2026-09-05'),
      lineStatus: '已傳送第一階段勸導通知',
      twoCNotes: '首次通知',
    },
    {
      uid: 'V-2609-002',
      name: '許美玲',
      email: 'meiling.hsu@gmail.com',
      phone: '0988-222-333',
      outstandingAmount: 16000,
      outstandingDays: 35,
      billDate: new Date('2026-09-02'),
      collectionStartDate: new Date('2026-09-06'),
      stage: 'CLOSED',
      isClosed: true,
      closedDate: new Date('2026-09-08'),
      lineNoticeDate: new Date('2026-09-06'),
      lineStatus: '收到通知後即刻匯款',
      twoCNotes: '2C Line 通知後已結案',
    },
  ];

  for (const c of recentValetCases) {
    await prisma.caseRecord.create({
      data: {
        ...c,
        businessUnit: 'VALET',
      },
    });
  }

  // 5. Seed Pepper Cases
  const pepperCases = [
    {
      uid: 'P-HIST-001',
      name: '鼎豐國際餐飲有限公司',
      email: 'accounting@dingfeng.com.tw',
      phone: '02-2789-1234',
      outstandingAmount: 156000,
      outstandingDays: 130,
      billDate: new Date('2026-04-05'),
      collectionStartDate: new Date('2026-05-10'),
      stage: 'STAGE_4',
      businessUnit: 'PEPPER',
      demandNoticeDate: new Date('2026-06-10'),
      demandDueDate: new Date('2026-06-25'),
      demandDocUrl: 'https://docs.google.com/document/d/1pepper-demand-dingfeng',
      terminationNoticeDate: new Date('2026-07-15'),
      terminationDocUrl: 'https://docs.google.com/document/d/1pepper-term-dingfeng',
      faNotes: '終止合作滿15天未結案，轉入待呆帳沖銷',
    },
    {
      uid: 'P-HIST-002',
      name: '樂活早午餐坊',
      email: 'lohas.brunch@gmail.com',
      phone: '02-8765-4321',
      outstandingAmount: 82000,
      outstandingDays: 60,
      billDate: new Date('2026-05-15'),
      collectionStartDate: new Date('2026-06-10'),
      stage: 'CLOSED',
      isClosed: true,
      closedDate: new Date('2026-06-28'),
      businessUnit: 'PEPPER',
      twoCNotes: '已由負責人分期結清款項',
    },
    {
      uid: 'P-2607-001',
      name: '極品咖啡館',
      email: 'premium.cafe@gmail.com',
      phone: '0966-123-987',
      outstandingAmount: 48000,
      outstandingDays: 82,
      billDate: new Date('2026-07-01'),
      collectionStartDate: new Date('2026-07-08'),
      stage: 'STAGE_3',
      businessUnit: 'PEPPER',
      lineNoticeDate: new Date('2026-07-09'),
      demandNoticeDate: new Date('2026-08-15'),
      demandDueDate: new Date('2026-08-30'),
      demandDocUrl: 'https://docs.google.com/document/d/1pepper-demand-cafe',
      terminationNoticeDate: new Date('2026-09-03'),
      terminationDocUrl: 'https://docs.google.com/document/d/1pepper-term-cafe',
      faNotes: '已寄送終止合約通知函',
    },
    {
      uid: 'P-2608-001',
      name: '饗樂燒肉殿',
      email: 'feast.yakiniku@gmail.com',
      phone: '0977-888-111',
      outstandingAmount: 64000,
      outstandingDays: 55,
      billDate: new Date('2026-08-05'),
      collectionStartDate: new Date('2026-08-15'),
      stage: 'STAGE_2',
      businessUnit: 'PEPPER',
      lineNoticeDate: new Date('2026-08-15'),
      demandNoticeDate: new Date('2026-09-02'),
      demandDueDate: new Date('2026-09-16'),
      demandDocUrl: 'https://docs.google.com/document/d/1pepper-demand-yakiniku',
      faNotes: 'FA 催告期，等待回覆中',
    },
    {
      uid: 'P-2609-001',
      name: '晨光手作烘焙',
      email: 'morning.bakery@gmail.com',
      phone: '0981-222-777',
      outstandingAmount: 28000,
      outstandingDays: 36,
      billDate: new Date('2026-09-01'),
      collectionStartDate: new Date('2026-09-07'),
      stage: 'STAGE_1',
      businessUnit: 'PEPPER',
      lineNoticeDate: new Date('2026-09-07'),
      lineStatus: '已讀未回',
      twoCNotes: '2C 第一階段 Line 勸導中',
    },
  ];

  for (const c of pepperCases) {
    await prisma.caseRecord.create({
      data: c,
    });
  }

  console.log('✅ Valet and Pepper cases seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
