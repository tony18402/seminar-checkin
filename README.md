# seminar-checkin

Production-focused **Seminar Registration & QR Check-in System** built with **Next.js (App Router)** and **Supabase**.  
Designed for real event operations (search/filter, admin actions, exports) and scalable usage (e.g., ~1,400 attendees).

---

## ✨ Key Features

- **Registration**: region / organization / province, coordinator info, hotel selection, participant list, food type
- **QR-based attendee page**: open by token and support check-in flow
- **Admin dashboard**:
  - Search by name / organization
  - Filter by status (checked-in / not checked-in), region, province
  - Force check-in / uncheck-in (if enabled)
  - Slip upload / manage (if enabled)
- **Export**: Excel/CSV (and optional PDF workflows depending on your routes)

---

## 🧱 Tech Stack

- **Next.js** (App Router) + **TypeScript**
- **Supabase** (Postgres, Auth, Storage)
- Deploy-friendly: **Vercel** (recommended) / **Docker**

---

## 📦 Getting Started (Local)

### 1) Install dependencies
```bash
npm install
# or
yarn
# or
pnpm install
# or
bun install
