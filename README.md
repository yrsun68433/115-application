# 115 院學士學位學程 一審審查頁面

社科院院學士學位學程加修學系一審審查用的內部工具。以 Vite + React 撰寫，資料存放於
Supabase（PostgreSQL），可多裝置同步編輯，取代原本存在瀏覽器本機（`window.storage` /
localStorage）的版本。

## 目錄結構

```
115-coss-review/
├── index.html
├── package.json
├── vite.config.js
├── .env.example          複製為 .env 並填入 Supabase 金鑰
├── src/
│   ├── main.jsx
│   ├── App.jsx            主要畫面與邏輯
│   └── supabaseClient.js  Supabase 連線設定
└── supabase/
    ├── schema.sql          資料表結構（先執行）
    └── seed.sql            45 位申請人種子資料（後執行）
```

## 一、建立 Supabase 專案與資料表

1. 至 [supabase.com](https://supabase.com) 建立新專案（免費方案即可）。
2. 進入專案的 **SQL Editor**，貼上 `supabase/schema.sql` 全部內容並執行，
   會建立 `applicants` 資料表與必要的權限設定。
3. 再貼上 `supabase/seed.sql` 全部內容並執行，會匯入 45 位申請人的初始資料
   （含目前已知的聯絡方式、收件狀態與備註）。
4. 至 **Project Settings → API**，複製以下兩個值，稍後會用到：
   - `Project URL`（對應 `VITE_SUPABASE_URL`）
   - `anon public` key（對應 `VITE_SUPABASE_ANON_KEY`）

> 目前資料表權限設定為「所有持有網址與金鑰者皆可讀寫」，適合僅內部分享連結使用的情境。
> 若之後要更嚴謹的存取控制，可改用 Supabase Auth，並將 `schema.sql` 內的 RLS
> 政策改為依 `auth.uid()` 判斷。

## 二、本機開發

```bash
npm install
cp .env.example .env
# 編輯 .env，填入上一步複製的 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY
npm run dev
```

瀏覽器開啟終端機顯示的網址（預設 http://localhost:5173）即可看到畫面。

## 三、上架到 GitHub

```bash
cd 115-coss-review
git init
git add .
git commit -m "init: 115 院學士一審審查頁面"
git branch -M main
git remote add origin https://github.com/<你的帳號>/115-coss-review.git
git push -u origin main
```

`.env` 已列在 `.gitignore` 中，不會被上傳，Supabase 金鑰不會外洩到 GitHub 上。

## 四、部署（以 Netlify 為例，與你既有的 115-ntu-coss 系統一致的作法）

1. 至 [Netlify](https://app.netlify.com) → **Add new site → Import an existing project**，
   選擇剛才 push 的 GitHub repo。
2. Build 設定：
   - Build command：`npm run build`
   - Publish directory：`dist`
3. **重要**：環境變數要設定在「Site configuration → Environment variables」（Site 層級），
   不是 Team 層級，否則 build 時讀不到，這是你先前在別的專案也遇過的地雷。
   新增：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 點 Deploy，完成後即可用 Netlify 給的網址分享給需要協助審查的同事。

若改用 GitHub Pages，記得在 `vite.config.js` 內加上對應的 `base` 路徑設定；
Netlify 則不需要。

## 五、資料欄位說明

| 欄位 | 說明 |
|---|---|
| `status` | 收件／審查狀態，五種固定選項：未確認、已收件、格式不符待補件、已補件收件、未提交申請書 |
| `has_application` | 是否已實際查得該生申請書電子檔（與 `status` 分開記錄，供未來篩選使用） |
| `name_note` | 姓名或學號的提醒事項（例如自填姓名與名冊寫法不同、學號誤植等） |
| `note` | 可自由編輯的通知紀錄／備註欄 |

## 六、⚠ 已知待確認事項（人數核對）

依現有兩份文件（`一審規格不符_全_.pdf` 與 `第一階段_且符合_全_.pdf`）比對 45 人名冊後，
共有 **10 位**申請人在兩份文件中都查無申請書，已標記為「未提交申請書」：

陳妍臻、楊正佑、翁子甯、陳甦民、蔡秉軒、邱苡晨、謝有恒、郭伊軒、劉昱麟、郭致維

這個數字與你原先預期的 7 人不同，請協助確認是否有其中 3 人的申請書是透過其他管道
（例如另一份尚未提供給我的文件）收到的；若有，請直接於畫面上把對應的人的狀態改為
「已收件」，或告訴我名單我再幫你更新 `seed.sql`。
