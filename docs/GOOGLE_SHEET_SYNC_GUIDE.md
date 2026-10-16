# Google 試算表「2bad-debtbackup」資料回寫與串接設定指南

本指南說明如何將本系統與 Google 試算表 **2bad-debtbackup** 進行無縫串接，實現：
1. 每週上傳 OutstandingReport 自動覆蓋原始分頁（`OutstandingReportValet` / `OutstandingReportPepper`）。
2. 自動依人名/UID 彙整呆帳總額（客人欠多個月款項自動加總），整理寫入追蹤分頁（`Valet扣款失敗通知追蹤` / `Pepper扣款失敗通知追蹤`）。
3. 智慧保留重複欠款客人的結案歷史紀錄，新欠款自動新增一列追蹤未結案紀錄。
4. Valet 專屬欄位（Type of Service 與 地址），Pepper 則不含。
5. 消失名單（已付款客人）自動轉為「待確認是否結案」，2C 專員確認後一鍵結案並即時回寫。

---

## 試算表資訊
- **試算表名稱**：`2bad-debtbackup`
- **試算表網址**：[https://docs.google.com/spreadsheets/d/1ffoagvek5LyXFv4DPQIsNzSU2FesUSZl0OF2tkLHEV4/edit?usp=sharing](https://docs.google.com/spreadsheets/d/1ffoagvek5LyXFv4DPQIsNzSU2FesUSZl0OF2tkLHEV4/edit?usp=sharing)
- **試算表 ID**：`1ffoagvek5LyXFv4DPQIsNzSU2FesUSZl0OF2tkLHEV4`

---

## 3 分鐘設定步驟 (Google Apps Script Web App)

透過 Google Apps Script Web App 串接，**無需申請複雜的 GCP 服務帳號金鑰**，穩定且免維護：

### 步驟 1：開啟 Apps Script
1. 開啟上方試算表網址：`https://docs.google.com/spreadsheets/d/1ffoagvek5LyXFv4DPQIsNzSU2FesUSZl0OF2tkLHEV4/edit?usp=sharing`。
2. 點擊頂端選單的 **「擴充功能」 (Extensions)** > **「Apps Script」**。

### 步驟 2：貼上後端整合腳本
1. 將編輯器內原本預設的 `function myFunction() { ... }` 全部清空。
2. 開啟專案內的 `google-apps-script/Code.gs` 檔案，複製全部程式碼，貼到 Apps Script 編輯器中。
3. 點擊上方磁碟片圖示 **「儲存專案」 (Save project)**。

### 步驟 3：部署為網路應用程式 (Web App)
1. 點擊右上角藍色的 **「部署」 (Deploy)** 按鈕 > 選擇 **「新增部署作業」 (New deployment)**。
2. 點擊左側「選取類型」齒輪圖示，選擇 **「網路應用程式」 (Web app)**。
3. 填寫部署設定（**非常重要！**）：
   - **說明 (Description)**：`2bad-debtbackup 回寫 API`
   - **執行身分 (Execute as)**：`我 (Me / 您的 Google 帳號)`
   - **誰可以存取 (Who has access)**：`任何人 (Anyone)` *(讓催帳系統伺服器能夠直接發送回寫請求)*
4. 點擊右下角 **「部署」 (Deploy)**。

### 步驟 4：授權應用程式權限
1. 首次部署會跳出授權視窗，點擊 **「審查權限」 (Authorize access)**。
2. 選擇您的 Google 帳號。
3. 若出現「Google 未驗證此應用程式」的畫面：
   - 點擊左下角的 **「進階」 (Advanced)**。
   - 點擊 **「前往『未命名專案』(不安全) / Go to ... (unsafe)」**。
   - 點擊 **「允許」 (Allow)**。

### 步驟 5：複製網址並填入伺服器環境變數
- **您已部署成功的 Web App 網址**：
  ```
  https://script.google.com/macros/s/AKfycbzbayhWa_N7qzx_jhw7R9uRp1v6itw7zK8amzcbdEXHMP96mt91dXaPnUPhuEj9JvcR/exec
  ```
- **目前系統環境變數設定狀態**：
  已於 `server/.env` 與系統設定中完成更新：
  ```env
  GOOGLE_DEBT_BACKUP_URL=https://script.google.com/macros/s/AKfycbzbayhWa_N7qzx_jhw7R9uRp1v6itw7zK8amzcbdEXHMP96mt91dXaPnUPhuEj9JvcR/exec
  DEBT_BACKUP_SPREADSHEET_ID=1ffoagvek5LyXFv4DPQIsNzSU2FesUSZl0OF2tkLHEV4
  ```
- **連線測試結果**：已成功與試算表「`2bad-debtbackup`」完成通訊驗證，並已自動就緒 4 大工作表分頁！


---

## 試算表 4 大分頁架構與回寫機制

當您第一次上傳報表或前端進行催帳修改時，Apps Script 會自動在試算表建立或排版以下 4 個工作表分頁：

### 1. `OutstandingReportValet` (原始報表，每週覆蓋)
- 每週 2C team 上傳 Valet 報表時，系統自動將整份 12 欄位資料完全覆蓋至本分頁。
- 欄位包含：
  `UID` | `Name` | `Email` | `Phone` | `Address` | `Type of Service` | `inv Date` | `Inv ID` | `Invoiced Amount` | `Outstanding Days` | `Total Outstanding Amount` | `Blue Code`

### 2. `OutstandingReportPepper` (原始報表，每週覆蓋)
- 每週 2C team 上傳 Pepper 報表時，系統自動將整份 12 欄位資料完全覆蓋至本分頁。

### 3. `Valet扣款失敗通知追蹤` (Valet 彙整與回寫追蹤表)
- 系統自動以人名/UID 彙整（多筆發票總額自動加總），整理填入：
  `UID` | `Type of Service` | `NAME` | `Outstanding Days` | `Email` | `地址` | `Total Outstanding Amount` | `Phone`
- **前端回寫欄位**：
  `催帳階段/狀態` | `追蹤標籤` | `結案狀態` | `結案日期` | `Line通知日` | `Line狀態` | `Email通知日` | `Email狀態` | `電話通知日` | `電話狀態` | `2C催帳備註` | `催告通知日` | `催告到期日` | `催告文件連結` | `終止函日期` | `終止函文件連結` | `FA備註` | `最後更新時間`
- **重複欠款處理**：若該客戶先前已結案再次欠款，系統會保留前次已結案紀錄，自動新增一列追蹤未結案的那筆。

### 4. `Pepper扣款失敗通知追蹤` (Pepper 彙整與回寫追蹤表)
- 系統自動以人名/UID 彙整，整理填入：
  `UID` | `NAME` | `Email` | `Outstanding Days` | `Total Outstanding Amount` | `Phone` *(無 Type of Service 與 地址)*
- **前端回寫欄位**：同 Valet 追蹤表。

---

## 每週上傳與「待確認是否結案」流程

1. **每週上傳**：2C team 於前端點擊「上傳報表」，選擇 Valet 或 Pepper 的 Excel / CSV。
2. **自動加總與覆蓋**：系統自動加總同 UID 的款項，並覆蓋試算表原始分頁，更新追蹤分頁。
3. **自動偵測已付款**：若原本在名單中但本次報表未出現的客戶，系統自動將狀態轉為「**待確認是否結案**」。
4. **前端確認與即時回寫**：
   - 2C 專員在前端「待確認是否結案」篩選列表檢視。
   - 確認已繳款後，點擊「確認結案」。
   - 系統即刻將結案狀態與日期回寫至 Google 試算表對應分頁的對應客戶列！

---

## 欄位對應方式（2026-10-08 更新）

Apps Script 依**試算表第一列的表頭名稱**找欄位，不依欄位順序。前端欄位與試算表欄位對應如下（Valet、Pepper 相同）：

| 前端欄位 | 試算表欄位 |
|---|---|
| Line 通知日期 | LINE日期 |
| Email 通知日期 | 寄信日期 |
| 簡訊通知日期（新增） | 寄簡訊日期 |
| CS 勸導詳細備註 | 處理方式/客人回應 |
| 結案狀態設定（轉結案當天日期） | 結案日期 |
| 催告方式（Email／存證信函） | 催告方式 |
| 電子催告簡訊日期 | 電子催告簡訊日期 |
| 電子催告檔（上傳或貼上網址） | 電子催告檔（儲存格顯示「Link」，點擊開啟檔案） |
| 催告日期 | 電子催告日期 |
| 催告到期日 | 「電子催告日期」左側最近的 **到期日期** |
| 終止簡訊通知 | 終止簡訊通知 |
| 終止函發送日期 | 服務終止日 |
| 終止 到期日期 | 「服務終止日」左側最近的 **到期日期** |
| 存證信函 發送日期 | 存證信函 |
| 存證信函 收件日期 | 收件日期 |
| 報表 Phone | Phone（以文字寫入，保留開頭 0） |

- 兩個「到期日期」欄位名稱相同，系統依其右側相鄰的「電子催告日期／服務終止日」判斷，請讓每個「到期日期」放在對應欄位的左邊。
- 表頭比對忽略大小寫與空白（`LINE日期`、`Line日期` 皆可）。
- 若缺少上表欄位（「到期日期」除外），第一次回寫時會自動補在最右側。
- 上傳的電子催告檔存放在試算表同一資料夾下的「2bad-debtbackup 附件」資料夾（無權限時改存部署者雲端硬碟根目錄），上傳完成即自動回填該案件的「電子催告檔」欄位，不需再按儲存。
- 可在 Apps Script 編輯器執行 `checkColumnMapping`，於「執行記錄」檢查每個欄位對應到哪一欄。

> ⚠️ 更新 `Code.gs` 後，需貼回 Apps Script，先在編輯器選 `authorizeDrive` 按「執行」並允許 Google 雲端硬碟權限，再到「部署 → 管理部署作業 → 編輯 → 版本：新版本」重新部署。少了授權這一步，前端上傳電子催告檔會失敗。

---

## 上傳報表後試算表沒有更新？（2026-10-12）

上傳完成後，視窗會顯示 Google 試算表的實際回寫結果：
- 成功：顯示寫入「OutstandingReportValet/Pepper」幾列、追蹤表更新/新增幾筆。
- 失敗：顯示紅色錯誤原因，可按「重新同步到試算表」重試（不用重新上傳）。

常見錯誤：
| 錯誤訊息 | 處理方式 |
|---|---|
| 無法連線到 Google Apps Script | 部署設定「誰可以存取」需為「任何人」，並以「新版本」重新部署 |
| 找不到 UID 欄位 | 追蹤表第一列表頭需有「UID」 |
| 回應格式錯誤 | Apps Script 需重新授權：在編輯器執行任一函式並按允許，再重新部署 |

在瀏覽器開啟 Web App 網址，回應中的 `version` 應為 `2026-10-12`；若沒有 `version`，代表 Apps Script 還是舊版。

---

## 案件ID 與多人共用資料（2026-10-16）

### 試算表是唯一的資料來源
- 前端不再把案件存在各自的瀏覽器裡，而是直接讀寫「Valet/Pepper扣款失敗通知追蹤」。
- 任何人儲存 2C/FA 紀錄或結案，會先寫入試算表，成功才顯示「已儲存」；失敗會顯示錯誤，不會假裝存好。
- 其他人的畫面每 60 秒、或切回分頁時自動重新讀取；也可以按案件清單右上角的重新整理。
- 讀不到試算表時，畫面會顯示提示，並暫時顯示這台電腦上次讀到的資料。

### 案件ID
- 格式：`UID-01`、`UID-02`…，同一位客戶每次重新欠款加 1。
- 上傳 OutstandingReport 時自動產生：
  - 同 UID 有未結案的列 → 更新那一列（不給新 ID）
  - 同 UID 都已結案、或第一次欠款 → 新增一列，給下一個 ID
  - 未結案但不在本次報表 → 追蹤標籤改為「待確認是否結案」
- 前端回寫一律依案件ID找列，已結案的舊案件不會被新欠款覆蓋，修改舊案也不會寫到新案。
- 案件ID空白的舊列，會在下一次讀取或回寫時自動補號（依列的先後順序）；也可以在 Apps Script 編輯器手動執行 `backfillCaseIds`。
- 請不要手動修改已產生的案件ID。

### 判斷「已結案」的規則
- 「結案狀態」為「已結案 / 結案 / TRUE」→ 已結案
- 「結案狀態」空白、但「結案日期」有值 → 也視為已結案
- 其他情況 → 追蹤中

### 新增的欄位
第一次回寫時，若追蹤表沒有以下欄位，會自動補在最右側：`帳單日`（儀表板月份統計用）、`開始催帳日`。

> ⚠️ 必須先更新並重新部署 Apps Script（`version` 應為 `2026-10-16`），再更新前端；否則前端讀不到案件。
