<h1 align="center">DevMentor — Backend API</h1>

<p align="center">
  <strong>A production-grade, credit-based mentorship & code review marketplace</strong><br/>
  Built with Node.js · TypeScript · Prisma 7 · PostgreSQL · bKash · Vercel
</p>

<p align="center">
  <a href="https://dev-mentor-server.vercel.app/api/v1/health">
    <img src="https://img.shields.io/badge/status-live-brightgreen?style=flat-square" alt="Live Status" />
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-blue?style=flat-square" alt="Node Version" />
  <img src="https://img.shields.io/badge/typescript-v7-blue?style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/prisma-v7-2D3748?style=flat-square" alt="Prisma" />
  <img src="https://img.shields.io/badge/deployed-vercel-black?style=flat-square" alt="Vercel" />
</p>

---

## 🌐 Live Demo

| Resource | URL |
|---|---|
| **API Base URL** | `https://dev-mentor-server.vercel.app/api/v1` |
| **Health Check** | [GET /health](https://dev-mentor-server.vercel.app/api/v1/health) |
| **GitHub Repo** | [Zihad-1883/L2-A6-DevMentor-Server](https://github.com/Zihad-1883/L2-A6-DevMentor-Server) |

---

## 📖 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [API Modules](#-api-modules)
- [Credit System](#-credit-system)
- [Payment Flow](#-payment-flow-bkash)
- [Security](#-security)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Scripts](#-scripts)

---

## 🎯 Project Overview

**DevMentor** is a full-featured, production-deployed backend platform that connects students with expert mentors through a **credit-based economy**. Students purchase credits via bKash, then spend credits on:

- **1-on-1 Sprint Sessions** — Personal mentorship over a scheduled multi-day program
- **Group Cohort Programs** — Structured group classes run by verified mentors
- **Code Review Marketplace** — Asynchronous expert code reviews with SLA guarantees

Every credit transaction is **atomically escrowed** using Prisma database transactions, ensuring zero credit loss even under failure conditions.

---

## ✨ Key Features

| Feature | Details |
|---|---|
| **3-Role Auth System** | Student, Mentor, Admin with strict route guards |
| **Credit Wallet** | Escrow-based credit locking for sessions & reviews |
| **bKash Payments** | Tokenized Checkout integration with PDF email receipts |
| **Sprint Sessions** | 1-on-1 scheduling with mentor conflict detection |
| **Cohort Programs** | Group classes with gated access for enrolled students |
| **Code Review Marketplace** | QUICK (10 credits / 2hr SLA) & DEEP (50 credits / 24hr SLA) tiers |
| **Preview Lock** | 10-minute exclusive mentor review lock system |
| **Admin Governance** | Mentor approval, cohort moderation, user management |
| **Rate Limiting** | Upstash Redis-backed request throttling |
| **Email Receipts** | Automated Nodemailer PDF receipts on every payment |
| **Cron Jobs** | Daily midnight cleanup of expired payment sessions |
| **File Uploads** | Cloudinary CDN for avatars, PDFs, and resources |
| **Zod Validation** | Field-level structured error responses on every endpoint |

---

## 🛠 Tech Stack

### Core
| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 20 | Runtime |
| **TypeScript** | v7 | Type safety |
| **Express** | v5 | HTTP server |
| **Prisma ORM** | v7 | Database access |
| **PostgreSQL** | Latest | Primary database |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Vercel** | Serverless deployment |
| **Prisma Postgres** | Managed PostgreSQL hosting |
| **Upstash Redis** | Rate limiting & caching |
| **Cloudinary** | Media file storage & CDN |

### Auth & Payments
| Technology | Purpose |
|---|---|
| **Better Auth** | Session-based authentication |
| **bKash Tokenized Checkout** | BDT payment gateway |
| **Nodemailer + PDFKit** | Email receipts with PDF generation |

### Dev Tools
| Technology | Purpose |
|---|---|
| **tsup** | TypeScript bundler |
| **tsx** | Development runtime |
| **Zod v4** | Runtime schema validation |
| **node-cron** | Scheduled jobs |

---

## 🏗 Architecture

```
src/
├── config/          # Environment validation (Zod-parsed)
├── lib/             # Prisma client, Better Auth setup, Redis
├── middlewares/     # Auth guard, rate limiter, error handler
├── modules/         # Feature modules (Route → Controller → Service)
│   ├── admin/
│   ├── codeReview/
│   ├── cohort/
│   ├── cohortSession/
│   ├── enrollment/
│   ├── mentor/
│   ├── payment/
│   ├── sprint/
│   ├── sprintSession/
│   ├── upload/
│   └── user/
├── routes/          # Central route registry
├── jobs/            # Cron job definitions
├── utils/           # Shared helpers (email, PDF, response)
├── app.ts           # Express app configuration
└── server.ts        # HTTP server entry point

api/
└── index.ts         # Vercel serverless entry point

prisma/
├── schema/          # Prisma schema files
├── migrations/      # SQL migration history
└── seed.ts          # Admin user seeder
```

**Request lifecycle:**
```
Request → Rate Limiter → Auth Guard → Route → Controller → Service → Prisma → DB
```

---

## 📦 API Modules

### 🔐 Authentication (`/auth`)
- Register, Login, Logout via Better Auth email/password
- Session token auto-management
- Role-based route protection middleware

### 👤 User & Profile (`/users`)
- Profile CRUD with role-aware dashboard stats
- Mentor bio and avatar management

### 🧑‍🏫 Mentor Directory (`/mentors`)
- Public searchable directory with tech stack tag filtering
- Mentor application → Admin approval workflow
- Role upgraded atomically on approval

### 🏃 Sprint Requests (`/sprints`)
- Students create 1-on-1 sprint requests
- Mentors browse and claim from open pool
- Auto-generates session slots for each selected day

### 🗓️ Sprint Sessions (`/sprint-sessions`)
- Mentor proposes time slots with conflict detection
- Student confirms → credits escrowed from wallet
- Complete → credits released to mentor
- Cancel → full refund if >1 hour before start

### 👥 Cohort Programs (`/cohorts`)
- Mentor-created group classes (Admin approval required)
- Capacity enforcement and duplicate enrollment prevention
- Gated access: non-enrolled students cannot see resources

### 🎓 Cohort Sessions (`/cohort-sessions`)
- Session scheduling with credit price per join
- Resource attachment (LINK, VIDEO, PDF) for enrolled students
- Escrow-based joining with bulk refund on cancellation

### 🧑‍💻 Code Review Marketplace (`/code-reviews`)
- **QUICK tier** — 10 credits, 2-hour SLA
- **DEEP tier** — 50 credits, 24-hour SLA
- 10-minute exclusive preview lock per mentor
- Inline comment threads with severity levels (SECURITY, SUGGESTION, etc.)
- Student approval gates credit release to mentor

### 💳 Payments & Wallet (`/payments`)
- bKash Tokenized Checkout for BDT → Credit top-ups
- Atomic wallet credit on successful payment callback
- Mentor cash-out withdrawal via bKash
- Full invoice and transaction history

### 🛡️ Admin Panel (`/admin`)
- Paginated user directory with search, role, and block filters
- Mentor application approval/rejection with reason
- Cohort program moderation
- User account block/unblock

---

## 💰 Credit System

```
1 Credit = 4 BDT

Operation                  Cost
──────────────────────────────────────
QUICK Code Review        10 Credits (escrowed until delivered)
DEEP Code Review         50 Credits (escrowed until delivered)
Sprint Session           Per session (escrowed at confirmation)
Cohort Session Join      Per session credit price (escrowed at join)
```

All credit operations use **Prisma database transactions** to guarantee atomicity. If any step fails, the entire operation rolls back — no partial states, no lost credits.

---

## 💳 Payment Flow (bKash)

```
Student sends POST /payments/top-up { amount: 500 }
       ↓
Server creates bKash payment session
       ↓
Returns { bkashURL: "https://..." }
       ↓
Student completes payment on bKash
       ↓
bKash redirects to GET /payments/bkash/callback?paymentID=...&status=success
       ↓
Server executes payment via bKash API
       ↓
Credits added to wallet (Prisma transaction)
       ↓
PDF receipt generated and emailed via Nodemailer
```

---

## 🔒 Security

- **Helmet.js** — HTTP security headers on every response
- **CORS** — Whitelist-based origin control
- **Upstash Redis Rate Limiting** — Per-IP request throttling
- **`trust proxy`** — Correct IP detection behind Vercel's edge
- **Zod Validation** — All inputs validated before reaching the service layer
- **Role Guards** — Middleware-level role enforcement, not just at the DB level
- **Auth Session Tokens** — Better Auth session management with database-backed sessions

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20
- PostgreSQL database (or Prisma Postgres)
- bKash sandbox credentials
- Cloudinary account
- Upstash Redis instance

### Installation

```bash
# Clone the repository
git clone https://github.com/Zihad-1883/L2-A6-DevMentor-Server.git
cd L2-A6-DevMentor-Server

# Install dependencies (automatically runs prisma generate)
npm install

# Copy environment template
cp .env.example .env

# Add your environment variables to .env
# See Environment Variables section below

# Apply database schema
npx prisma db push

# Seed admin account
npm run seed

# Start development server
npm run dev
```

---

## 🔧 Environment Variables

```env
# Database
DATABASE_URL=

# Server
PORT=5000
NODE_ENV=development

# Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000

# bKash
BKASH_BASE_URL=
BKASH_USERNAME=
BKASH_PASSWORD=
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_CALLBACK_URL=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

See `.env.example` for all available variables.

---

## 📜 Scripts

```bash
npm run dev        # Start dev server with hot reload (tsx watch)
npm run build      # Generate Prisma client + bundle with tsup
npm run start      # Run production bundle
npm run seed       # Seed admin user to database
```

---

## 📁 Postman Collection

A complete Postman collection (`DevMentor API.postman_collection.json`) is included in the repository root covering all 50+ API endpoints, organized into folders with pre-filled request bodies and an auto-save token script on login.

**Import steps:**
1. Open Postman → Import → select the `.json` file
2. Set `baseUrl` collection variable to `https://dev-mentor-server.vercel.app/api/v1`
3. Use **Login (Get Token)** — token is auto-saved to `{{token}}`

---

## 👤 Author

**Zihad Ahmed**
- GitHub: [@Zihad-1883](https://github.com/Zihad-1883)
- Project: [L2-A6-DevMentor-Server](https://github.com/Zihad-1883/L2-A6-DevMentor-Server)

---

<p align="center">
  Built as part of the Programming Hero Level 2 — Assignment 6
</p>
