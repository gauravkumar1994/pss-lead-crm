# PSS CRM — Redeploy guide (Smart Bulk Automation + Admin DB Panel)

Bhai, ye guide bilkul beginner ke liye hai. Saari nayi cheezein jo abhi banayi gayi hain — Smart Bulk Automation, Bulk Permissions (admin), Database Panel (admin) — sab Render pe live karne ke liye sirf **3 cheezein** karni hain: code push → API redeploy → Web redeploy.

> ⚠ **Important**: Saari nayi cheezein **PostgreSQL DB** par chalti hain — koi Google Sheet runtime nahi, koi Cloudinary nahi, koi Google Drive nahi. Excel file sirf **upload format** hai, server xlsx parse karke rows seedha PostgreSQL `bulk_recipients` table mein daal deta hai. Photo/video user khud **browse karke** attach karta hai (manual bulk jaisa); file CRM ke local media folder mein save hoti hai. `prisma db push` se nayi tables (`user_bulk_profiles`, `bulk_batches`, `bulk_recipients`) automatic ban jayengi.

---

## STEP 0 — Locally test (optional but recommended)

PowerShell mein:

```powershell
cd C:\Users\HP\.cursor\projects\empty-window\pss-lead-crm

# Pehle Postgres run hone do (Docker / native installation)
# Phir API
cd apps\api
npm run db:push        # nayi tables PostgreSQL mein bana dega
cd ..\..

# Dono apps run karo
npm run dev            # API port 4000 + Web port 3000
```

Browser: http://localhost:3000 → login → sidebar mein nayi entries dikhengi:

* **Smart Bulk Automation** (sab users ke liye)
* **Bulk Permissions** (sirf admin)
* **Database Panel** (sirf admin)

Agar local pe sab theek dikh raha hai, deployment safe hai.

---

## STEP 1 — Code GitHub par push karo

Workspace folder pe right-click → **Git Bash Here** ya **PowerShell Here**. Phir:

```powershell
cd C:\Users\HP\.cursor\projects\empty-window\pss-lead-crm

# Status check (kya files change hui hain dekho)
git status

# Sab changes stage karo
git add -A

# Commit message saaf likho
git commit -m "Smart Bulk Automation + Admin DB Panel (no sheet, no cloudinary)"

# Push to main
git push origin main
```

> Agar `git push` mein **authentication** maange to GitHub Personal Access Token (PAT) chahiye:
> `Settings → Developer settings → Personal access tokens (classic)` se ek banaao with `repo` scope, aur username ki jagah PAT paste karo.

---

## STEP 2 — Render API service redeploy (auto + DB migration)

1. https://dashboard.render.com pe login
2. Top-left **service switcher** se **`pss-crm-api`** select karo
3. **Auto-deploy** pehle se ON hai, isliye `git push` ke baad **~1-2 minute mein khud build start ho jata hai**. Build logs check karne ke liye left side **"Events"** ya **"Logs"** tab kholo
4. **Build command** confirm karo (Settings → Build & Deploy):

```
npm install && npm run build -w apps/api
```

5. **Start command** confirm karo:

```
npm run render:setup -w apps/api && npm run start -w apps/api
```

> `render:setup` = `prisma db push --accept-data-loss && tsx prisma/seed.ts`
>
> Ye command **automatic naye tables banayega** (UserBulkProfile, BulkBatch, BulkRecipient) PostgreSQL pe. Tum kuch nahi karna.

6. Build complete hone ke baad, browser mein kholo: `https://pss-crm-api.onrender.com/health` → `{ "ok": true }` aana chahiye

7. **Env vars** check (Environment tab) — ye honi chahiye:

| Key                | Value (example)                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`     | `postgresql://crm:****@dpg-d86ak3ndl75s73a4lf3g-a.oregon-postgres.render.com/pss_crm?sslmode=require` |
| `JWT_SECRET`       | (long random string)                                                                                  |
| `CORS_ORIGIN`      | `https://pss-crm-web.onrender.com`                                                                    |
| `PUBLIC_API_URL`   | `https://pss-crm-api.onrender.com`                                                                    |
| `BULK_TICK_MS`     | `60000` (optional — kitne ms baad worker run kare, default 60s)                                       |
| `MEDIA_MAX_BYTES`  | `20971520` (20 MB — Excel + photo/video upload ka size limit)                                         |

> 👉 `DATABASE_URL` ke end mein `?sslmode=require` honi **mandatory** hai, warna `P1001` aata hai.
> 👉 Google Drive ya Cloudinary kuch nahi chahiye. Photo/video user CRM mein browse karke upload karega; file `apps/api/data/uploads/` mein store hogi aur `/media/...` URL se serve hogi.

---

## STEP 3 — Render Web service redeploy

1. Service switcher se **`pss-crm-web`** select karo
2. Auto-deploy ON hai to push ke baad automatic build start hota hai. Manually start karna ho to top-right **"Manual deploy → Deploy latest commit"** click karo
3. **Build command**:

```
npm install && npm run build -w apps/web
```

4. **Start command**:

```
npm run start -w apps/web -- -p $PORT
```

5. **Env vars** check:

| Key                   | Value                                |
| --------------------- | ------------------------------------ |
| `NEXT_PUBLIC_API_URL` | `/api`                               |
| `API_PROXY_TARGET`    | `https://pss-crm-api.onrender.com`   |

Build complete = `https://pss-crm-web.onrender.com` open karo → login.

> Pehli login slow ho sakti hai (Render free tier cold start \~30-60 sec). Refresh karke retry karo, sab chal jayega.

---

## STEP 4 — Production smoke test (5 minute checklist)

### a) Admin se WhatsApp API assign karo
1. Admin se login (`gaurav` / your password)
2. Sidebar → **Team WhatsApp API**
3. Kisi user ki row pe **Edit** → Provider chuno (UltraMsg / AtozSender / Evolution), Instance ID, Access Token, Daily Limit fill karke **Save**
4. Wahin **Test** button click karke verify karo ki API working hai

### b) Admin se Bulk Permission + timing set karo
1. Sidebar → **Bulk Permissions**
2. Us user ki row mein **Bulk Enabled** toggle ON karo
3. **Rules edit** click karke timing + limits set:
   * **Daily target**: 50 (max messages per day for is user)
   * **Gap between messages**: 18 minutes (BEAST default)
   * **Start hour / End hour**: kab se kab tak is user ka bulk chalega (e.g. 09–21 IST)
   * **Notes**: optional
4. **Save rules**

> **Timing** = is user ke liye bulk worker sirf is window mein active rahega. Bahar ka time mein worker skip karega.

### c) User se bulk batch banao (Excel upload + browse photo)
1. Logout → us user se login
2. Sidebar → **Smart Bulk Automation**
3. Top mein 4 status pills dikhenge: **WhatsApp API: active**, **Bulk Permission: ENABLED**, **Daily target**, **Timing**

4. **Excel file format banao** (Excel ya Google Sheets export `.xlsx`/`.csv` se):

| name | mobile |
|------|--------|
| Rahul | 919876543210 |
| Priya | 9123456789 |
| Amit | +91 99887 76655 |

> Server tolerant hai — column order kuch bhi ho, header naam `name`/`mobile`/`phone`/`number` etc. detect kar leta hai. Agar header row nahi to col A = name, col B = mobile lega.

5. Form fill:
   * **Tab: Excel upload (recommended)** select karo
   * **Batch name**: `Test 23 May`
   * **Message**: `Hi {name}, ye test hai PSS se. {city} mein available.`
   * **Photo / video (optional)**: **Browse** button click karke apne computer se file select karo (jpg/png/mp4/webp). Upload turant hota hai, preview right side pe dikh jata hai.
   * **Excel file**: tumhari `.xlsx` upload karo
   * **Turant cloud queue mein activate** checkbox ON rakho
6. **Preview check karo** — right side panel mein WhatsApp jaisa preview dikhega (photo + personalized text using first Excel row)
7. **Upload + Create batch** click karo
8. Confirmation aayega: `N rows parsed, M cloud queue mein added, X duplicates dropped. Browser band kar sakte ho.`
9. Browser band kar do — **cloud server (Render API) ab khud bhejta rahega**
10. Kabhi bhi wapas aake `/bulk-automation` pe **Details** se progress check karo

> **Cloud-side execution**: ek baar batch ACTIVE ho gaya, Render API ka background worker har 60 sec mein tick karta hai. Tumhare user ke 18-min gap ke hisaab se ek-ek message bhejta hai. Browser/PC band ho jaye to bhi bhejna jari rahega (jab tak Render API running hai).

### c2) Alternative: paste numbers (small batches)
Excel ke chakkar mein nahi padna chahiye? **Paste numbers** tab choose karo. Lines:
```
9876543210, Rahul, Delhi
9123456789, Priya, Mumbai
```
Format same hai, max 5000 rows.

### Speed math (sale conversation ke liye)
- 1 user × 18 min gap × 12 hour window = max ~40 sends/day per user
- 5 users parallel = ~200 sends/day  (har user ka 18 min gap independent)
- Server idle nahi rehta — har minute tick check karta hai sab eligible users ke liye

### d) Admin se DB verify
1. Admin login → sidebar **Database Panel**
2. Left side se **Bulk batches** select karo → tumhara `Test 23 May` row dikhega
3. **Bulk recipients** select karo → 2 rows with status `SENT`/`PENDING`/`FAILED` dikhenge
4. **Users** mein password column auto-masked rahega (`passwordHash` ki jagah `—`)
5. **WhatsApp integrations** mein access token bhi auto-mask hai (sirf first 4 + last 3 chars)

> Agar yahan tak sab kaam karta hai, deployment 100% successful hai. **Sale-ready**.

---

## STEP 5 — Worker debugging (agar batch send nahi ho raha)

API logs mein dekho (`Logs` tab in Render):

```
[bulk-automation] starting — tick every 60000ms
```

Ye message har deploy ke baad ek baar aata hai. Agar nahi aaya, worker start hi nahi hua — usually env var missing.

Worker batch process nahi kar raha to checklist:

- [ ] User ki `UserBulkProfile.enabled` = `true` hai? (Admin → Bulk Permissions)
- [ ] User ki `UserWhatsAppIntegration.status` = `active` hai? (Admin → Team WhatsApp API)
- [ ] Abhi user ke time window mein hai? (startHour ≤ current hour < endHour, **server timezone**)
- [ ] User ka daily target khatam to nahi? (Bulk Permissions mein "Daily / Today" dekho)
- [ ] 18 min gap to nahi chal raha? (last sent ke 18 min baad next send hota hai)
- [ ] Batch ka status `ACTIVE` hai? (PENDING ko Start karo)
- [ ] Agar photo attach hai to URL valid hai? (DB Panel mein `bulk_batches.media_url` dekho — `/media/...` se shuru honi chahiye)

DB Panel se directly verify:
* `user_bulk_profiles` mein row: `enabled = true`, `sent_today < daily_target`, `last_sent_at` ka time check
* `bulk_batches` mein status `ACTIVE`
* `bulk_recipients` mein PENDING rows count > 0
* Failed recipient row pe `error` column khol ke padho — exact WhatsApp API error dikhega

---

## STEP 6 — Render free tier ke important notes (sale ke liye)

1. **Cold start**: 15 min idle ke baad API sleep ho jata hai, pehli request 30-60 sec leti hai. Solution: paid plan ($7/mo) ya https://cron-job.org se har 10 min `pss-crm-api.onrender.com/health` ping karwao
2. **DB free tier**: 1 GB only. Tab tak bohot data nahi banega. Production ke liye **Render PostgreSQL Standard** ($7/mo) recommended
3. **Background worker**: `setInterval` based hai, isliye API service sleep hote hi worker bhi rukega. Cold start ya paid plan se solve hota hai
4. **File uploads** (photo): `apps/api/data/uploads/` mein store hote hain. Render restart pe purane uploads delete ho sakte hain. Production-grade ke liye S3-compatible storage chahiye — bata dena to add kar denge
5. **Backups**: Render dashboard → Database → **Backups** tab. Free tier mein last 7 din ka daily backup mil jata hai

---

## STEP 7 — Quick reference URLs

* **App**: https://pss-crm-web.onrender.com
* **API health**: https://pss-crm-api.onrender.com/health
* **GitHub repo**: https://github.com/gauravkumar1994/pss-lead-crm
* **Render dashboard**: https://dashboard.render.com

---

## Naya kya kya hai (saari nayi features ki ek nazar mein list)

### Backend (apps/api)
* `prisma/schema.prisma` — `UserBulkProfile`, `BulkBatch`, `BulkRecipient` tables
* `src/routes/bulk-automation.ts` — `/my-profile`, `/profiles`, `/profiles/:userId`, `/import` (paste), `/import-excel` (multipart Excel upload), `/batches*`, `/dashboard`
* `src/routes/admin-db.ts` — `/tables`, `/tables/:key` (read-only DB browser)
* `src/worker/bulk-automation.ts` — background tick, BEAST rules (18-min gap, daily target, time window)
* `src/app.ts` — naye routes register, worker start
* `xlsx` dep added (server-side Excel parsing only — no Sheet runtime)

### Frontend (apps/web)
* `/bulk-automation` — 2 tabs: **Excel upload** (default) + **Paste numbers**, **WhatsApp preview pane** (right side), browse-photo/video upload
* `/bulk-automation/batches/[id]` — batch progress + per-recipient table
* `/bulk-automation/profiles` — admin: per-user permission + timing/limit rules
* `/admin/database` — admin: read-only DB browser
* Sidebar updated (`AppShell.tsx`), titles updated (`CrmShell.tsx`)
* `globals.css` — new styles (bulk-pill, progress-bar, switch toggle, db-panel-grid, badge-status-*)

### Rules implemented (BEAST logic adapted — no Cloudinary, no Drive, no matching)
| BEAST feature | Implementation |
|---|---|
| 18-min gap per user | `UserBulkProfile.gapMinutes` (default 18) |
| Daily target per user | `UserBulkProfile.dailyTarget` (default 50) + worker midnight reset |
| Time window per user | `UserBulkProfile.startHour` / `endHour` — admin sets |
| Permission toggle | `UserBulkProfile.enabled` (admin only) |
| Per-user API assignment | `UserWhatsAppIntegration` (admin: Ultra/Atoz/Evolution) |
| Per-user API daily cap | `UserWhatsAppIntegration.dailyLimit` |
| **Excel upload bulk numbers** | `POST /import-excel` multipart → xlsx parse → `bulk_recipients` |
| **Browse photo/video** | `MediaUploadField` — local upload, `/media/...` URL |
| **Preview pane** | Bulk page right side shows WhatsApp-style preview (photo + personalized text) |
| **Cloud-side execution** | `setInterval` worker on Render API — user PC/browser band kar sakte hain |
| Daily reset midnight | Worker `sameDay()` auto-detects day change |
| ❌ Country / Stage / LeadType matching | **Skipped (per your instruction)** |
| ❌ Cloudinary upload | **Skipped — local /media URL** |
| ❌ Google Drive auto-fetch | **Skipped — user browse karke khud select karta hai** |
| ❌ Google Sheets runtime | **Skipped — Excel sirf upload format, server xlsx parse karke PostgreSQL mein daalta hai** |

Done. Push karte hi sab live ho jayega.
