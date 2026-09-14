import { Prisma } from '@prisma/client';
import { startOfMonth, subMonths, isBefore, format } from 'date-fns';
import prisma from '../prisma';
import { computeStage } from './stageService';

export interface CaseFilterParams {
  businessUnit?: 'VALET' | 'PEPPER';
  stage?: string;
  monthBucket?: string; // 'older' | 'm_minus_2' | 'm_minus_1' | 'current'
  isClosed?: boolean;
  search?: string;
  minDays?: number;
  maxDays?: number;
  contactStatus?: string; // 'line_contacted' | 'email_contacted' | 'phone_contacted' | 'uncontacted'
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getCases(params: CaseFilterParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.CaseRecordWhereInput = {};

  if (params.businessUnit) {
    where.businessUnit = params.businessUnit;
  }

  if (params.stage) {
    if (params.stage === 'CLOSED') {
      where.isClosed = true;
    } else {
      where.stage = params.stage;
      where.isClosed = false;
    }
  }

  if (params.isClosed !== undefined) {
    where.isClosed = params.isClosed;
  }

  if (params.minDays !== undefined || params.maxDays !== undefined) {
    where.outstandingDays = {};
    if (params.minDays !== undefined) where.outstandingDays.gte = Number(params.minDays);
    if (params.maxDays !== undefined) where.outstandingDays.lte = Number(params.maxDays);
  }

  if (params.search) {
    const s = params.search.trim();
    where.OR = [
      { uid: { contains: s } },
      { name: { contains: s } },
      { email: { contains: s } },
      { phone: { contains: s } },
      { twoCNotes: { contains: s } },
      { faNotes: { contains: s } },
    ];
  }

  if (params.contactStatus) {
    if (params.contactStatus === 'line_contacted') {
      where.lineNoticeDate = { not: null };
    } else if (params.contactStatus === 'email_contacted') {
      where.emailNoticeDate = { not: null };
    } else if (params.contactStatus === 'phone_contacted') {
      where.phoneNoticeDate = { not: null };
    } else if (params.contactStatus === 'uncontacted') {
      where.lineNoticeDate = null;
      where.emailNoticeDate = null;
      where.phoneNoticeDate = null;
    }
  }

  const orderBy: Prisma.CaseRecordOrderByWithRelationInput = {};
  const sortField = params.sortBy || 'outstandingDays';
  const sortDir = params.sortOrder === 'asc' ? 'asc' : 'desc';

  if (['outstandingDays', 'outstandingAmount', 'createdAt', 'updatedAt', 'uid', 'name'].includes(sortField)) {
    (orderBy as any)[sortField] = sortDir;
  } else {
    orderBy.outstandingDays = 'desc';
  }

  const [totalCount, items] = await Promise.all([
    prisma.caseRecord.count({ where }),
    prisma.caseRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
  ]);

  // Aggregate sum for current filter
  const aggregates = await prisma.caseRecord.aggregate({
    where,
    _sum: {
      outstandingAmount: true,
    },
  });

  return {
    items,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
    totalAmountSum: aggregates._sum.outstandingAmount || 0,
  };
}

export async function getCaseById(id: string) {
  const caseRecord = await prisma.caseRecord.findUnique({
    where: { id },
    include: {
      auditLogs: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!caseRecord) {
    throw new Error('找不到該案件資料');
  }

  return caseRecord;
}

export async function update2CFields(
  id: string,
  data: {
    lineNoticeDate?: Date | string | null;
    lineStatus?: string | null;
    emailNoticeDate?: Date | string | null;
    emailStatus?: string | null;
    phoneNoticeDate?: Date | string | null;
    phoneStatus?: string | null;
    twoCNotes?: string | null;
    collectionStartDate?: Date | string | null;
  },
  userId: string
) {
  const existing = await prisma.caseRecord.findUnique({ where: { id } });
  if (!existing) throw new Error('案件不存在');

  const lineDate = data.lineNoticeDate ? new Date(data.lineNoticeDate) : data.lineNoticeDate === null ? null : existing.lineNoticeDate;
  const emailDate = data.emailNoticeDate ? new Date(data.emailNoticeDate) : data.emailNoticeDate === null ? null : existing.emailNoticeDate;
  const phoneDate = data.phoneNoticeDate ? new Date(data.phoneNoticeDate) : data.phoneNoticeDate === null ? null : existing.phoneNoticeDate;

  // Set collection start date if provided or auto-set to first notice date
  let collectionStartDate = data.collectionStartDate ? new Date(data.collectionStartDate) : existing.collectionStartDate;
  if (!collectionStartDate) {
    collectionStartDate = lineDate || emailDate || phoneDate || null;
  }

  const updated = await prisma.caseRecord.update({
    where: { id },
    data: {
      lineNoticeDate: lineDate,
      lineStatus: data.lineStatus !== undefined ? data.lineStatus : existing.lineStatus,
      emailNoticeDate: emailDate,
      emailStatus: data.emailStatus !== undefined ? data.emailStatus : existing.emailStatus,
      phoneNoticeDate: phoneDate,
      phoneStatus: data.phoneStatus !== undefined ? data.phoneStatus : existing.phoneStatus,
      twoCNotes: data.twoCNotes !== undefined ? data.twoCNotes : existing.twoCNotes,
      collectionStartDate,
    },
  });

  await prisma.auditLog.create({
    data: {
      caseRecordId: id,
      userId,
      action: 'UPDATE_2C_COLLECTION',
      details: JSON.stringify({
        before: {
          lineNoticeDate: existing.lineNoticeDate,
          lineStatus: existing.lineStatus,
          emailNoticeDate: existing.emailNoticeDate,
          emailStatus: existing.emailStatus,
          phoneNoticeDate: existing.phoneNoticeDate,
          phoneStatus: existing.phoneStatus,
          twoCNotes: existing.twoCNotes,
        },
        after: {
          lineNoticeDate: updated.lineNoticeDate,
          lineStatus: updated.lineStatus,
          emailNoticeDate: updated.emailNoticeDate,
          emailStatus: updated.emailStatus,
          phoneNoticeDate: updated.phoneNoticeDate,
          phoneStatus: updated.phoneStatus,
          twoCNotes: updated.twoCNotes,
        },
      }),
    },
  });

  return updated;
}

export async function updateFAFields(
  id: string,
  data: {
    demandNoticeDate?: Date | string | null;
    demandDueDate?: Date | string | null;
    demandDocUrl?: string | null;
    terminationNoticeDate?: Date | string | null;
    terminationDocUrl?: string | null;
    faNotes?: string | null;
  },
  userId: string
) {
  const existing = await prisma.caseRecord.findUnique({ where: { id } });
  if (!existing) throw new Error('案件不存在');

  const demandDate = data.demandNoticeDate ? new Date(data.demandNoticeDate) : data.demandNoticeDate === null ? null : existing.demandNoticeDate;
  const demandDue = data.demandDueDate ? new Date(data.demandDueDate) : data.demandDueDate === null ? null : existing.demandDueDate;
  const termDate = data.terminationNoticeDate ? new Date(data.terminationNoticeDate) : data.terminationNoticeDate === null ? null : existing.terminationNoticeDate;

  // Recompute stage with new termination date
  const newStage = existing.isClosed
    ? 'CLOSED'
    : computeStage({
        isClosed: false,
        outstandingDays: existing.outstandingDays,
        terminationNoticeDate: termDate,
      });

  const updated = await prisma.caseRecord.update({
    where: { id },
    data: {
      demandNoticeDate: demandDate,
      demandDueDate: demandDue,
      demandDocUrl: data.demandDocUrl !== undefined ? data.demandDocUrl : existing.demandDocUrl,
      terminationNoticeDate: termDate,
      terminationDocUrl: data.terminationDocUrl !== undefined ? data.terminationDocUrl : existing.terminationDocUrl,
      faNotes: data.faNotes !== undefined ? data.faNotes : existing.faNotes,
      stage: newStage,
    },
  });

  await prisma.auditLog.create({
    data: {
      caseRecordId: id,
      userId,
      action: 'UPDATE_FA_LEGAL',
      details: JSON.stringify({
        before: {
          demandNoticeDate: existing.demandNoticeDate,
          demandDueDate: existing.demandDueDate,
          demandDocUrl: existing.demandDocUrl,
          terminationNoticeDate: existing.terminationNoticeDate,
          terminationDocUrl: existing.terminationDocUrl,
          faNotes: existing.faNotes,
          stage: existing.stage,
        },
        after: {
          demandNoticeDate: updated.demandNoticeDate,
          demandDueDate: updated.demandDueDate,
          demandDocUrl: updated.demandDocUrl,
          terminationNoticeDate: updated.terminationNoticeDate,
          terminationDocUrl: updated.terminationDocUrl,
          faNotes: updated.faNotes,
          stage: updated.stage,
        },
      }),
    },
  });

  return updated;
}

export async function updateCaseClose(
  id: string,
  data: {
    isClosed: boolean;
    closedDate?: Date | string | null;
  },
  userId: string
) {
  const existing = await prisma.caseRecord.findUnique({ where: { id } });
  if (!existing) throw new Error('案件不存在');

  const closedDate = data.isClosed
    ? data.closedDate
      ? new Date(data.closedDate)
      : new Date()
    : null;

  const newStage = data.isClosed
    ? 'CLOSED'
    : computeStage({
        isClosed: false,
        outstandingDays: existing.outstandingDays,
        terminationNoticeDate: existing.terminationNoticeDate,
      });

  const updated = await prisma.caseRecord.update({
    where: { id },
    data: {
      isClosed: data.isClosed,
      closedDate,
      stage: newStage,
    },
  });

  await prisma.auditLog.create({
    data: {
      caseRecordId: id,
      userId,
      action: data.isClosed ? 'CLOSE_CASE' : 'REOPEN_CASE',
      details: JSON.stringify({
        before: { isClosed: existing.isClosed, closedDate: existing.closedDate, stage: existing.stage },
        after: { isClosed: updated.isClosed, closedDate: updated.closedDate, stage: updated.stage },
      }),
    },
  });

  return updated;
}
