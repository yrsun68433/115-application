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

## 四、部署到 Vercel

1. 至 [Vercel](https://vercel.com) → **Add New → Project**，選擇 GitHub repo（例如 `115-application`）。
2. Vercel 會自動偵測到 Vite 專案，預設值即可：
   - Build Command：`npm run build`
   - Output Directory：`dist`
   （本專案已附上 `vercel.json` 明確指定這兩項，避免自動偵測失準）
3. **關鍵步驟**：展開 **Environment Variables**，新增：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   兩個都要勾選 **Production、Preview、Development** 三個環境（否則 Preview 部署或本機
   `vercel dev` 會讀不到）。Vite 的環境變數是在 **build 當下**被打包進前端程式碼，
   所以一定要在按下 Deploy「之前」就設定好；如果是先部署才補設定，要記得回到
   Deployments 頁面手動 **Redeploy**，單純儲存環境變數不會自動觸發重新 build。
4. 按 Deploy。完成後若畫面空白或 console 出現「缺少 VITE_SUPABASE_URL」的錯誤，
   通常就是上一步環境變數沒設定或忘記 Redeploy。

> 補充：`npm install` 若卡住或報奇怪的相依性錯誤，可以先在本機刪除
> `node_modules`、重新 `npm install` 一次確認能跑，再把新產生的 `package-lock.json`
> 一併 commit 上去，讓 Vercel 的安裝結果與本機一致。

## 五、部署到 Netlify（另一種選擇，與你既有的 115-ntu-coss 系統一致的作法）

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

## 六、資料欄位說明

| 欄位 | 說明 |
|---|---|
| `status` | 收件／審查狀態，五種固定選項：未確認、已收件、格式不符待補件、已補件收件、未提交申請書 |
| `has_application` | 是否已實際查得該生申請書電子檔（與 `status` 分開記錄，供未來篩選使用） |
| `name_note` | 姓名或學號的提醒事項（例如自填姓名與名冊寫法不同、學號誤植等） |
| `note` | 可自由編輯的通知紀錄／備註欄 |

## 七、⚠ 已知待確認事項（人數核對，已於對話中確認）

依現有兩份文件（`一審規格不符_全_.pdf` 10 人、`第一階段_且符合_全_.pdf` 26 人）比對
45 人名冊：兩份文件有 1 人重複（鄒常偉，先列於格式不符名單，補件後對應到合格名單），
故不重複人數為 10 + 26 − 1 = 35 人已收件，45 − 35 = **10 位未提交申請書**（已於對話中
與你確認鄒常偉重複屬實，數字維持 10 人，非原先預期的 7 或 9 人）：

陳妍臻、楊正佑、翁子甯、陳甦民、蔡秉軒、邱苡晨、謝有恒、郭伊軒、劉昱麟、郭致維

若之後查出這 10 人中有人其實有繳交，可直接在畫面上把狀態改為「已收件」（會自動存進
Supabase），或告訴我名單，我再更新 `seed.sql`。
