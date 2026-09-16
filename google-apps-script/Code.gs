/**
 * ==============================================================================
 * 2bad-debtbackup Google 試算表自動化同步與回寫腳本 (Google Apps Script)
 * 試算表名稱: 2bad-debtbackup
 * 網址: https://docs.google.com/spreadsheets/d/1ffoagvek5LyXFv4DPQIsNzSU2FesUSZl0OF2tkLHEV4/edit?usp=sharing
 * ==============================================================================
 * 
 * 功能亮點：
 * 1. 自動建立與維護 4 個工作表分頁：
 *    - OutstandingReportValet (原始報表每週覆蓋)
 *    - OutstandingReportPepper (原始報表每週覆蓋)
 *    - Valet扣款失敗通知追蹤 (Valet 彙整與催帳/結案回寫)
 *    - Pepper扣款失敗通知追蹤 (Pepper 彙整與催帳/結案回寫)
 * 2. 智慧重複欠款支援：同一客戶若先前已結案再次欠款，保留歷史紀錄，新增一列追蹤尚未結案的那筆。
 * 3. 欄位精準區分：Valet 專屬包含「服務類型 (Type of Service)」與「地址 (Address)」，Pepper 則不含。
 * 4. 支援前端單筆即時回寫與整批報表匯入覆蓋。
 */

// 定義工作表分頁名稱
var SHEET_NAMES = {
  VALET_RAW: 'OutstandingReportValet',
  PEPPER_RAW: 'OutstandingReportPepper',
  VALET_TRACKING: 'Valet扣款失敗通知追蹤',
  PEPPER_TRACKING: 'Pepper扣款失敗通知追蹤'
};

// Valet 追蹤表欄位定義
var VALET_TRACKING_HEADERS = [
  'UID',
  'Type of Service',
  'NAME',
  'Outstanding Days',
  'Email',
  '地址',
  'Total Outstanding Amount',
  'Phone',
  '催帳階段/狀態',
  '追蹤標籤',
  '結案狀態',
  '結案日期',
  'Line通知日',
  'Line狀態',
  'Email通知日',
  'Email狀態',
  '電話通知日',
  '電話狀態',
  '2C催帳備註',
  '催告通知日',
  '催告到期日',
  '催告文件連結',
  '終止函日期',
  '終止函文件連結',
  'FA備註',
  '最後更新時間'
];

// Pepper 追蹤表欄位定義 (無 Type of Service 與 地址)
var PEPPER_TRACKING_HEADERS = [
  'UID',
  'NAME',
  'Email',
  'Outstanding Days',
  'Total Outstanding Amount',
  'Phone',
  '催帳階段/狀態',
  '追蹤標籤',
  '結案狀態',
  '結案日期',
  'Line通知日',
  'Line狀態',
  'Email通知日',
  'Email狀態',
  '電話通知日',
  '電話狀態',
  '2C催帳備註',
  '催告通知日',
  '催告到期日',
  '催告文件連結',
  '終止函日期',
  '終止函文件連結',
  'FA備註',
  '最後更新時間'
];

/**
 * 處理 POST 請求 (API 呼叫端點)
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // 等待最多 30 秒鎖定，避免多筆同時寫入衝突
    lock.waitLock(30000);
    
    var payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ success: false, error: '未提供 POST 資料' });
    }

    var action = payload.action;
    var businessUnit = (payload.businessUnit || '').toUpperCase(); // 'VALET' | 'PEPPER'
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'OVERWRITE_RAW_REPORT') {
      // 覆蓋寫入原始報表
      var result = handleOverwriteRawReport(ss, businessUnit, payload.headers, payload.rows);
      return jsonResponse({ success: true, action: action, result: result });
    } 
    else if (action === 'SYNC_SUMMARY_TRACKING') {
      // 同步/彙整追蹤清單
      var result = handleSyncSummaryTracking(ss, businessUnit, payload.items);
      return jsonResponse({ success: true, action: action, result: result });
    } 
    else if (action === 'UPDATE_ROW_STATUS') {
      // 前端單筆回寫
      var result = handleUpdateRowStatus(ss, businessUnit, payload.uid, payload.fields);
      return jsonResponse({ success: true, action: action, result: result });
    } 
    else {
      return jsonResponse({ success: false, error: '未知操作: ' + action });
    }

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString(), stack: err.stack });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 處理 GET 請求 (健康檢查或測試)
 */
function doGet(e) {
  return jsonResponse({
    status: 'ok',
    message: '2bad-debtbackup Google Apps Script Web App 正常運作中',
    spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
    sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function(s) { return s.getName(); })
  });
}

/**
 * 輔助：回傳 JSON 格式
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 取得或建立工作表，並設定標題樣式
 */
function getOrCreateSheet(ss, sheetName, defaultHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  if (defaultHeaders && defaultHeaders.length > 0) {
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.appendRow(defaultHeaders);
      var headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4F46E5');
      headerRange.setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * 1. 覆蓋寫入原始報表 (OutstandingReportValet / OutstandingReportPepper)
 */
function handleOverwriteRawReport(ss, businessUnit, headers, rows) {
  var sheetName = businessUnit === 'VALET' ? SHEET_NAMES.VALET_RAW : SHEET_NAMES.PEPPER_RAW;
  var sheet = getOrCreateSheet(ss, sheetName);
  
  // 清空整張工作表內容
  sheet.clearContents();
  sheet.clearFormats();

  if (!headers || headers.length === 0) {
    headers = [
      'UID', 'Name', 'Email', 'Phone', 'Address', 'Type of Service', 
      'inv Date', 'Inv ID', 'Invoiced Amount', 'Outstanding Days', 
      'Total Outstanding Amount', 'Blue Code'
    ];
  }

  // 寫入表頭
  sheet.appendRow(headers);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(businessUnit === 'VALET' ? '#DC2626' : '#059669');
  headerRange.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  if (rows && rows.length > 0) {
    var range = sheet.getRange(2, 1, rows.length, headers.length);
    range.setValues(rows);
  }

  return {
    sheetName: sheetName,
    rowCount: rows ? rows.length : 0
  };
}

/**
 * 2. 彙整並同步至追蹤工作表 (Valet扣款失敗通知追蹤 / Pepper扣款失敗通知追蹤)
 * 核心規則：
 * - 同一客戶若先前已結案又再欠款，不覆蓋舊紀錄，新增一筆追蹤未結案的那筆。
 * - 若有未結案的紀錄，更新其最新欠款金額、逾期天數等數值，保留先前填寫的催帳備註。
 */
function handleSyncSummaryTracking(ss, businessUnit, items) {
  var isValet = businessUnit === 'VALET';
  var sheetName = isValet ? SHEET_NAMES.VALET_TRACKING : SHEET_NAMES.PEPPER_TRACKING;
  var headers = isValet ? VALET_TRACKING_HEADERS : PEPPER_TRACKING_HEADERS;
  var sheet = getOrCreateSheet(ss, sheetName, headers);

  var lastRow = sheet.getLastRow();
  var existingData = [];
  if (lastRow > 1) {
    existingData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  }

  // 欄位索引對應
  var colUid = headers.indexOf('UID');
  var colName = headers.indexOf('NAME');
  var colDays = headers.indexOf('Outstanding Days');
  var colAmount = headers.indexOf('Total Outstanding Amount');
  var colEmail = headers.indexOf('Email');
  var colPhone = headers.indexOf('Phone');
  var colStage = headers.indexOf('催帳階段/狀態');
  var colTag = headers.indexOf('追蹤標籤');
  var colClosed = headers.indexOf('結案狀態');
  var colClosedDate = headers.indexOf('結案日期');
  var colServiceType = isValet ? headers.indexOf('Type of Service') : -1;
  var colAddress = isValet ? headers.indexOf('地址') : -1;
  var colUpdatedAt = headers.indexOf('最後更新時間');

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

  // 將現有工作表以 UID 分組，尋找未結案的那一列 (索引)
  // key: UID -> array of { rowIndex: number (1-based), isClosed: boolean, row: any[] }
  var uidMap = {};
  for (var i = 0; i < existingData.length; i++) {
    var r = existingData[i];
    var uidVal = String(r[colUid] || '').trim();
    if (!uidVal) continue;

    var closedVal = String(r[colClosed] || '').trim();
    var isRowClosed = closedVal === '已結案' || closedVal.toLowerCase() === 'true' || closedVal === '結案';

    if (!uidMap[uidVal]) {
      uidMap[uidVal] = [];
    }
    uidMap[uidVal].push({
      sheetRowIndex: i + 2, // 試算表實際列號
      isClosed: isRowClosed,
      data: r
    });
  }

  var updatedCount = 0;
  var newCount = 0;

  for (var k = 0; k < items.length; k++) {
    var item = items[k];
    var uid = String(item.uid || '').trim();
    if (!uid) continue;

    var existingEntries = uidMap[uid] || [];
    // 找出尚未結案的那筆紀錄
    var activeEntry = null;
    for (var m = 0; m < existingEntries.length; m++) {
      if (!existingEntries[m].isClosed) {
        activeEntry = existingEntries[m];
        break;
      }
    }

    if (activeEntry) {
      // 存在未結案紀錄：更新數值，保留原有催帳紀錄
      var rowIdx = activeEntry.sheetRowIndex;
      var curRow = activeEntry.data;

      // 更新數值
      if (colName !== -1 && item.name) curRow[colName] = item.name;
      if (colDays !== -1) curRow[colDays] = item.outstandingDays;
      if (colAmount !== -1) curRow[colAmount] = item.totalOutstandingAmount;
      if (colEmail !== -1 && item.email) curRow[colEmail] = item.email;
      if (colPhone !== -1 && item.phone) curRow[colPhone] = item.phone;
      if (isValet) {
        if (colServiceType !== -1 && item.serviceType) curRow[colServiceType] = item.serviceType;
        if (colAddress !== -1 && item.address) curRow[colAddress] = item.address;
      }
      if (colTag !== -1) {
        curRow[colTag] = item.statusTag === 'PENDING_CONFIRMATION' ? '待確認是否結案' : (item.statusTag || '正常追蹤');
      }
      if (colStage !== -1 && item.stage) {
        curRow[colStage] = item.stage;
      }
      if (colUpdatedAt !== -1) curRow[colUpdatedAt] = nowStr;

      sheet.getRange(rowIdx, 1, 1, headers.length).setValues([curRow]);
      updatedCount++;
    } else {
      // 不存在未結案紀錄（可能此客戶第一次欠款，或先前已經結案了再次欠款）
      // 依據使用者需求：「如果已經結案如又再欠款，不會覆蓋前面欠款的紀錄，到時候追蹤的會是還沒結案的那筆」
      // -> 新增一筆全新的列！
      var newRow = new Array(headers.length).fill('');
      if (colUid !== -1) newRow[colUid] = item.uid;
      if (colName !== -1) newRow[colName] = item.name;
      if (colDays !== -1) newRow[colDays] = item.outstandingDays;
      if (colAmount !== -1) newRow[colAmount] = item.totalOutstandingAmount;
      if (colEmail !== -1) newRow[colEmail] = item.email || '';
      if (colPhone !== -1) newRow[colPhone] = item.phone || '';
      if (isValet) {
        if (colServiceType !== -1) newRow[colServiceType] = item.serviceType || '';
        if (colAddress !== -1) newRow[colAddress] = item.address || '';
      }
      if (colStage !== -1) newRow[colStage] = item.stage || 'STAGE_1';
      if (colTag !== -1) newRow[colTag] = item.statusTag === 'PENDING_CONFIRMATION' ? '待確認是否結案' : '正常追蹤';
      if (colClosed !== -1) newRow[colClosed] = '未結案';
      if (colUpdatedAt !== -1) newRow[colUpdatedAt] = nowStr;

      sheet.appendRow(newRow);
      newCount++;
    }
  }

  return {
    sheetName: sheetName,
    updatedCount: updatedCount,
    newCount: newCount,
    totalItems: items.length
  };
}

/**
 * 3. 前端單筆回寫 (當 2C/FA 在前端調整催帳狀態、備註或結案狀態時即時回寫)
 * 優先比對「尚未結案」的那一筆，以確保追蹤的是當前未結案案件！
 */
function handleUpdateRowStatus(ss, businessUnit, uid, fields) {
  var isValet = businessUnit === 'VALET';
  var sheetName = isValet ? SHEET_NAMES.VALET_TRACKING : SHEET_NAMES.PEPPER_TRACKING;
  var headers = isValet ? VALET_TRACKING_HEADERS : PEPPER_TRACKING_HEADERS;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('找不到工作表: ' + sheetName);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error('工作表目前無資料列');
  }

  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var colUid = headers.indexOf('UID');
  var colClosed = headers.indexOf('結案狀態');

  var targetRowIdx = -1;
  var targetRowData = null;

  // 優先找出該 UID 且「尚未結案」的列；若找不到則取最新的一列
  for (var i = data.length - 1; i >= 0; i--) {
    var r = data[i];
    if (String(r[colUid]).trim() === String(uid).trim()) {
      var closedVal = String(r[colClosed] || '').trim();
      var isClosed = closedVal === '已結案' || closedVal === '結案';
      if (!isClosed) {
        targetRowIdx = i + 2;
        targetRowData = r;
        break;
      }
      if (targetRowIdx === -1) {
        targetRowIdx = i + 2;
        targetRowData = r;
      }
    }
  }

  if (targetRowIdx === -1) {
    return { success: false, message: '在工作表中找不到 UID ' + uid + ' 的對應列' };
  }

  // 依照欄位名稱進行更新
  var fieldMapping = {
    stage: '催帳階段/狀態',
    statusTag: '追蹤標籤',
    isClosed: '結案狀態',
    closedDate: '結案日期',
    lineNoticeDate: 'Line通知日',
    lineStatus: 'Line狀態',
    emailNoticeDate: 'Email通知日',
    emailStatus: 'Email狀態',
    phoneNoticeDate: '電話通知日',
    phoneStatus: '電話狀態',
    twoCNotes: '2C催帳備註',
    demandNoticeDate: '催告通知日',
    demandDueDate: '催告到期日',
    demandDocUrl: '催告文件連結',
    terminationNoticeDate: '終止函日期',
    terminationDocUrl: '終止函文件連結',
    faNotes: 'FA備註'
  };

  for (var key in fields) {
    if (fields.hasOwnProperty(key) && fieldMapping[key]) {
      var headerName = fieldMapping[key];
      var colIdx = headers.indexOf(headerName);
      if (colIdx !== -1) {
        var val = fields[key];
        if (key === 'isClosed') {
          val = val ? '已結案' : '未結案';
        } else if (key === 'statusTag') {
          val = val === 'PENDING_CONFIRMATION' ? '待確認是否結案' : (val === 'NORMAL' ? '正常追蹤' : val);
        } else if (val === null || val === undefined) {
          val = '';
        }
        targetRowData[colIdx] = val;
      }
    }
  }

  var colUpdatedAt = headers.indexOf('最後更新時間');
  if (colUpdatedAt !== -1) {
    targetRowData[colUpdatedAt] = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  }

  sheet.getRange(targetRowIdx, 1, 1, headers.length).setValues([targetRowData]);

  return {
    success: true,
    sheetName: sheetName,
    rowIndex: targetRowIdx,
    uid: uid
  };
}
