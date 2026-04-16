# AdharaEdu — Production-Ready Full Stack Platform

## What's Built

### Backend (NestJS + Prisma + PostgreSQL) — 27 modules

| Module | Description |
|--------|-------------|
| Auth | Login, register, JWT, roles, change password |
| Schools | Multi-school management, stats, approval flow |
| Students | Enrollment with welcome email, reg numbers, progress |
| Tutors | Profile, school assignments, stats |
| Modules | Curriculum, progress tracking, auto-unlock |
| Attendance | Bulk mark, class view, weekly breakdown |
| CBT | Exam builder, vetting, start/submit/auto-grade, result email |
| Exams | Scheduled exams per school |
| **Exam Scheduler** | Assign CBT to class + date, notifies students by email |
| Reports | Weekly tutor reports, submit, review |
| Notices | School announcements |
| Payments | Invoice management |
| **Paystack** | Online payment gateway, webhook, receipt email |
| **Certificates** | PDF generation, QR code, Cloudinary upload, verify endpoint |
| **Email** | All transactional emails via SMTP (Nodemailer + Handlebars) |
| **Messages** | Tutor ↔ Student direct messaging |
| Lessons | Lesson plan CRUD |
| **Class Assignments** | Tutor creates, students submit, tutor grades, email notify |
| **Sessions** | Log when tutor starts/ends a session |
| **Payroll** | Calculate per-session pay, mark paid, email tutor |
| Notifications | In-app bell notifications |
| Uploads | Cloudinary file storage |
| Users | Profile updates |

### Email Events (automatic)
| Trigger | Recipients |
|---------|------------|
| Student enrolled | Student (credentials, reg number, portal link) |
| School approved | School Admin (next steps) |
| Exam scheduled | All students in the class (date, time, venue, access code) |
| CBT result submitted | Student (score, grade, pass/fail) |
| Assignment posted | All students in the class |
| Assignment graded | Student (score + feedback) |
| Payment confirmed | School Admin (receipt) |
| Tutor payroll processed | Tutor (amount, sessions) |
| Weekly report submitted | All Super Admins |

### Frontend (Next.js 14) — Fully Integrated

| Page | Integration |
|------|-------------|
| /auth/login | POST /auth/login |
| /auth/register | POST /auth/register |
| /cbt | CBT login → exam → auto-graded result |
| /payment/verify | Paystack callback verification |
| /verify-certificate/:serial | Public certificate verification |
| /dashboard/admin | schools, students, attendance, notices, payments + Paystack |
| /dashboard/tutor | tutors/me, classes, attendance, CBT, reports, lessons, messages, assignments |
| /dashboard/student | modules, attendance, assignments, certificates (real PDF), notifications, messages |
| /dashboard/superadmin | schools, approvals, tutors, payments, reports (reviewable), CBT vetting, payroll |

## Setup

### Backend

```bash
cd adharaedu/backend
npm install

# Configure
cp .env.example .env
# Edit .env — fill in all values

# Database
npx prisma generate
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts

# Start
npm run start:dev
# http://localhost:3001/api/v1
# http://localhost:3001/api/docs (Swagger)
```

### Frontend

```bash
cd adharaedu-final
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3002/api/v1" > .env.local
npm run dev
# http://localhost:3000
```

### Deploy frontend on Vercel

1. Push this repo to GitHub and open [Vercel](https://vercel.com) → **Add New Project** → import the repository.
2. Set **Root Directory** to `frontend` (monorepo).
3. Framework: Next.js (auto-detected). Package manager: **pnpm** (lockfile in `frontend`).
4. **Environment variables** (Production — and Preview if you want PR previews to hit a real API):

   | Name | Example |
   |------|---------|
   | `NEXT_PUBLIC_API_URL` | `https://your-backend-host.com/api/v1` |

   Use the public URL of your Nest API (for example the same app deployed on [Render](https://render.com) per `render.yaml` in the repo root). Redeploy after changing env vars.

5. On the **backend**, set `FRONTEND_URL` to your Vercel production URL (e.g. `https://adharaedu.vercel.app`). You can list multiple origins separated by commas. Preview URLs `https://*.vercel.app` are allowed by default for CORS; set `CORS_ALLOW_VERCEL_PREVIEW=false` on the API if you want to allow only listed origins.

## Environment Variables

### Backend `.env`
```env
DATABASE_URL=postgresql://...
JWT_SECRET=min-32-char-secret
JWT_EXPIRES_IN=7d
PORT=3001
FRONTEND_URL=http://localhost:3000

# Email (Gmail App Password — enable 2FA first)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=adharaEdu0@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# Paystack (from dashboard.paystack.com/settings/developer)
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
```

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@adharaedu.com | SuperAdmin@123 |
| School Admin | admin@crownheights.edu.ng | SchoolAdmin@123 |
| Tutor | tutor@adharaedu.com | Tutor@123 |
| Student | aisha@crownheights.edu.ng | Student@123 |
| Parent | funke.okonkwo@gmail.com | Parent@123 |

## Key Flows

### Pay for a term (School Admin)
1. Admin Dashboard → Payments → Click "Pay Now" on pending invoice
2. Redirected to Paystack checkout (card, bank transfer, USSD)
3. On success → redirected to `/payment/verify?reference=...`
4. System marks payment as paid, sends email receipt to admin

### Issue a certificate (School Admin)
1. Admin Dashboard → Students → click "Issue Certificate" on a student who completed all modules
2. Certificate PDF generated, uploaded to Cloudinary
3. Student receives congratulations email with download link
4. Certificate is verifiable at `/verify-certificate/<serial>`

### Schedule an exam (Tutor/Admin)
1. Tutor creates CBT questions → submits for vetting
2. Super Admin reviews and approves
3. Tutor/Admin schedules the approved exam to a class + date/time
4. All students in that class get email + in-app notification with access code
5. Student goes to /cbt, enters reg number + access code → takes exam → gets result email

### Session tracking (Tutor)
1. Tutor clicks "Start Session" on dashboard
2. System logs start time + school + class
3. Tutor marks attendance during session
4. Tutor clicks "End Session" → logs duration + students present
5. Session data feeds into monthly payroll calculation
