<h1 align="center">DevMentor — Backend API Engine</h1>

<p align="center">
  <strong>A production-grade, credit-based mentorship, code review marketplace & learning management system</strong><br/>
  Built with Node.js · TypeScript · Express 5 · Prisma 7 · PostgreSQL · Better Auth · bKash · Upstash Redis · Cloudinary · Vercel
</p>

<p align="center">
  <a href="https://dev-mentor-server.vercel.app/api/v1/health">
    <img src="https://img.shields.io/badge/status-live-brightgreen?style=for-the-badge&logo=vercel" alt="Live Status" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node Version" />
  <img src="https://img.shields.io/badge/TypeScript-v7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-v7-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-v16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

---

## 🌐 Live Deployment & Resources

| Resource | URL / Link | Description |
|---|---|---|
| **Production API Base URL** | `https://dev-mentor-server.vercel.app/api/v1` | Live API endpoint on Vercel Edge Serverless |
| **Health Check Endpoint** | [`GET /health`](https://dev-mentor-server.vercel.app/api/v1/health) | Live deployment status check |
| **Published Postman Docs** | [Live Postman Documentation](https://documenter.getpostman.com/view/55049501/2sBYHNVhEw) | Interactive web documentation for all 65+ endpoints |
| **GitHub Repository** | [Zihad-1883/L2-A6-DevMentor-Server](https://github.com/Zihad-1883/L2-A6-DevMentor-Server) | Complete source code & configuration |
| **Postman JSON File** | [`DevMentor API.postman_collection.json`](./DevMentor%20API.postman_collection.json) | Raw collection file for Postman import |

---

## 📖 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features Summary](#-key-features-summary)
- [System Architecture](#-system-architecture)
- [Core Functional Modules](#-core-functional-modules)
  - [1. Authentication & Security](#1-authentication--security-auth)
  - [2. User Profiles & Dashboards](#2-user-profiles--dashboards-users)
  - [3. Mentor Applications & Directory](#3-mentor-applications--directory-mentors)
  - [4. Code Review Marketplace](#4-code-review-marketplace-code-reviews)
  - [5. 1-on-1 Sprint Mentorship](#5-1-on-1-sprint-mentorship-sprints--sprint-sessions)
  - [6. Cohort Learning Programs](#6-cohort-learning-programs-cohorts--cohort-sessions)
  - [7. Online Exam & Quiz Engine](#7-online-exam--quiz-engine-exams)
  - [8. Enrollments & Access Management](#8-enrollments--access-management-enrollments)
  - [9. Media & Asset Storage](#9-media--asset-storage-upload)
  - [10. Wallet, Payments & Payouts](#10-wallet-payments--payouts-payments)
  - [11. Admin Governance & Moderation](#11-admin-governance--moderation-admin)
- [Credit Economy & Escrow Mechanism](#-credit-economy--escrow-mechanism)
- [Payment Gateway Integration (bKash)](#-payment-gateway-integration-bkash)
- [Complete API Endpoints Directory](#-complete-api-endpoints-directory)
- [Local Development Setup](#-local-development-setup)
- [Environment Variables Reference](#-environment-variables-reference)
- [Postman Test Automation](#-postman-test-automation)
- [Author](#-author)

---

## 🎯 Project Overview

**DevMentor Backend Engine** is an enterprise-level platform that bridges the gap between aspiring developers and experienced mentors through an automated **credit-based marketplace economy**. 

Students purchase platform credits using **bKash Tokenized Payment Gateway**, receiving instant PDF receipts via email. They can spend credits on:
1. **Async Code Review Marketplace** — QUICK (2-hour SLA) & DEEP (24-hour SLA) tiers with exclusive 10-minute preview locking, line-by-line comments, and student approval escrow releases.
2. **1-on-1 Sprint Mentorship** — Custom multi-day sprint packages with conflict-aware session scheduling.
3. **Cohort Learning Programs** — Structured group classes with gated access protection for paid members.
4. **Interactive Exam & Assessment Engine** — Automated MCQ testing with instant evaluation, passing criteria, and attempt history tracking.

Every credit transaction is **atomically managed using Prisma DB Transactions**, ensuring zero credit duplication or balance drift under high concurrency or server failures.

---

## ✨ Key Features Summary

| Feature Category | Highlights & Functionality |
|---|---|
| **Role-Based Auth (RBAC)** | Student, Mentor, and Admin role enforcement with Better Auth sessions |
| **Credit Escrow System** | Atomic wallet holds, payouts, and refunds for sessions and code reviews |
| **bKash Payment Gateway** | Automated BDT top-ups via Tokenized Checkout API with PDF receipts |
| **Code Review Marketplace** | QUICK (10cr / 2hr SLA) & DEEP (50cr / 24hr SLA) with 10-min Preview Locks |
| **1-on-1 Sprint Mentorship** | Custom sprint requests, mentor proposal slots, and conflict detection |
| **Cohort Group Programs** | Capacity management, gated media resources, and group video sessions |
| **Online Exam Engine** | MCQ question bank, sanitized student payloads, automated real-time grading |
| **Media CDN Uploads** | Direct Cloudinary stream uploads for avatars, PDFs, and learning materials |
| **Admin Moderation** | User block/unblock, mentor application reviews, cohort program approvals |
| **Automated Cron Cleanup** | Background job worker clearing abandoned payment sessions every 5 minutes |

---

## 🏗 System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │             Client / Postman / UI            │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTP / JSON
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │           Vercel Serverless Edge             │
                               │               Express 5 App                  │
                               └──────────────────────┬───────────────────────┘
                                                      │
         ┌────────────────────────────────────────────┼────────────────────────────────────────────┐
         │                                            │                                            │
         ▼                                            ▼                                            ▼
┌─────────────────┐                          ┌─────────────────┐                          ┌─────────────────┐
│ Security Layer  │                          │  Better Auth    │                          │ File Storage    │
│ Helmet + CORS   │                          │ Session Engine  │                          │ Cloudinary CDN  │
└────────┬────────┘                          └────────┬────────┘                          └────────┬────────┘
         │                                            │                                            │
         └────────────────────────────────────────────┼────────────────────────────────────────────┘
                                                      │
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │            Module Route Handlers             │
                               │   (Validation via Zod Schemas + RBAC Guard)  │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │              Controller Layer                │
                               │        (HTTP Request/Response Handling)      │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │              Service Layer                   │
                               │  (Business Logic + Prisma DB Transactions)   │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │           PostgreSQL Database                │
                               │   (Prisma ORM 7 Managed Schema & Audit)      │
                               └──────────────────────────────────────────────┘
```

---

## 📦 Core Functional Modules

### 1. 🔐 Authentication & Security (`/auth`)
- Built on top of **Better Auth** with database session tracking.
- Supports email/password authentication, registration, session validation, and logout.
- Middleware guards (`requireAuth`, `requireRole`) enforce strict route protection.

### 2. 👤 User Profiles & Dashboards (`/users`)
- Profile fetch and update endpoints (name, bio, image avatar).
- Role-specific dashboard endpoints returning customized analytical counters:
  - **Student Dashboard**: Enrolled cohorts, active sprints, pending code reviews, wallet balance.
  - **Mentor Dashboard**: Assigned reviews, sprint requests, cohort sessions, total earnings.
  - **Admin Dashboard**: Total platform users, active mentors, pending cohort approvals, transaction revenue.

### 3. 🧑‍🏫 Mentor Applications & Directory (`/mentors`)
- Public searchable directory of approved mentors with expertise filtering.
- Student application workflow for becoming a mentor (resume link, bio, tech stack submission).
- Admin approval pipeline that atomically upgrades user role from `student` to `mentor` upon acceptance.

### 4. 🧑‍💻 Code Review Marketplace (`/code-reviews`)
- **Tiers**:
  - `QUICK`: 10 Credits (2-Hour SLA) — Fast reviews for small PRs or single scripts.
  - `DEEP`: 50 Credits (24-Hour SLA) — Comprehensive reviews for full repos or architecture.
- **10-Minute Preview Lock**: Mentors acquire an exclusive 10-minute preview window to evaluate code before officially claiming the review.
- **Line-by-Line Comment Threads**: Mentors submit reviewed snippets and inline comments categorized by severity (`INFO`, `SUGGESTION`, `WARNING`, `SECURITY`).
- **Escrow Approval Release**: Credits remain held in escrow until the student verifies and approves the review feedback.

### 5. 🏃 1-on-1 Sprint Mentorship (`/sprints` & `/sprint-sessions`)
- Students post 1-on-1 sprint requests with desired start dates and target topics.
- Mentors claim open requests and propose specific time slots.
- **Conflict Detection Engine**: Prevents mentors from booking overlapping sessions.
- Students confirm proposed slots ➔ Credits held in escrow.
- Full credit refunds automatically granted if cancelled >1 hour prior to session start time.

### 6. 👥 Cohort Learning Programs (`/cohorts` & `/cohort-sessions`)
- Mentors create structured Cohort programs requiring Admin approval before going live.
- Enrollment cap enforcement to manage group class size.
- **Gated Access Control**: Non-enrolled users can view syllabus outlines, but session meeting links and attached media resources (PDFs, repositories, videos) are hidden until student enrollment is confirmed.

### 7. 📝 Online Exam & Quiz Engine (`/exams`)
- Mentors create customized MCQ exams in `DRAFT` status and attach multiple-choice questions.
- **Publishing Pipeline**: Mentors publish exams when ready for student taking.
- **Sanitized Payload Generation**: When a student starts an exam attempt, the backend strips all correct answer keys from the response.
- **Automated Grading & Passing**: Upon submission, the engine auto-grades answers, calculates score percentage, determines pass/fail status, and logs attempt history.

### 8. 🎓 Enrollments & Access Management (`/enrollments`)
- Unified tracking of a student's active and completed cohort programs and sprint sessions.
- Prevents duplicate enrollments and ensures proper authorization for learning content.

### 9. 📁 Media & Asset Storage (`/upload`)
- Integrated with **Cloudinary CDN**.
- Supports stream-based uploads for profile avatars, resume PDFs, code review screenshots, and cohort learning resources.

### 10. 💳 Wallet, Payments & Payouts (`/payments`)
- **Exchange Rate**: 1 Credit = 4 BDT.
- Direct integration with **bKash Tokenized Checkout API** (`createPayment`, `executePayment`, `queryPayment`).
- **PDF Receipt Generation**: Automated compilation of PDF invoices via **PDFKit** dispatched to student email using **Nodemailer SMTP**.
- **Mentor Cash-Out**: Mentors submit cash-out requests to withdraw earned credits to their bKash numbers.

### 11. 🛡️ Admin Governance & Moderation (`/admin`)
- Paginated user management directory with search, role filters, and block/unblock toggles.
- Moderation queue for reviewing and approving/rejecting mentor applications and cohort programs.

---

## 💰 Credit Economy & Escrow Mechanism

```
                            ┌────────────────────────┐
                            │ Student Wallet Balance │
                            └───────────┬────────────┘
                                        │
                         [Create Request / Join Session]
                                        │
                                        ▼
                            ┌────────────────────────┐
                            │  Platform Escrow Hold  │
                            │  (Deducted & Locked)   │
                            └───────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │                                             │
      [Successfully Delivered]                       [Cancelled / Timed Out]
                 │                                             │
                 ▼                                             ▼
  ┌─────────────────────────────┐               ┌─────────────────────────────┐
  │   100% Released to Mentor   │               │   100% Refunded to Student  │
  │     (Wallet Balance UP)     │               │     (Wallet Balance UP)     │
  └─────────────────────────────┘               └─────────────────────────────┘
```

All credit transactions are recorded in the `CreditTransaction` audit table with transaction types: `TOPUP`, `SPRINT_ESCROW`, `SPRINT_RELEASE`, `SPRINT_REFUND`, `WITHDRAWAL`.

---

## 💳 Payment Gateway Integration (bKash)

```
Student Request: POST /api/v1/payments/top-up { amount: 500 }
  │
  ├── 1. Backend requests Grant Token from bKash API
  ├── 2. Calls bKash Create Payment Endpoint
  ├── 3. Saves Payment Intent in DB (Status: INITIATED)
  └── 4. Returns { bkashURL: "https://sandbox.bKash.com/checkout/..." }
  │
Student completes payment on bKash UI
  │
bKash Redirects to GET /api/v1/payments/bkash/callback?paymentID=...&status=success
  │
  ├── 1. Backend executes payment with bKash Execute API
  ├── 2. Validates transaction status & amount
  ├── 3. Adds calculated Credits to Student Wallet (Prisma Transaction)
  ├── 4. Updates Payment Record to COMPLETED
  └── 5. Generates PDF Receipt ➔ Emails student via Nodemailer
```

---

## 📦 Complete API Endpoints Directory

### 🔐 Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/sign-up/email` | Register new user account | Public |
| `POST` | `/sign-in/email` | Log in and receive session token | Public |
| `POST` | `/sign-out` | Destroy active session | Authenticated |
| `GET` | `/get-session` | Get current authenticated user session | Authenticated |

### 👤 User & Profile (`/api/v1/users`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `GET` | `/me` | Get current user profile details | Authenticated |
| `PATCH` | `/me` | Update name, avatar, bio | Authenticated |
| `GET` | `/me/dashboard` | Get role-specific metrics & statistics | Authenticated |

### 🧑‍🏫 Mentor Directory & Applications (`/api/v1/mentors`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `GET` | `/` | Browse approved mentors public directory | Public |
| `GET` | `/:id` | Get public mentor profile details | Public |
| `POST` | `/apply` | Submit mentor application (resume, bio, stack) | Student |

### 🏃 Sprint Requests & Sessions (`/api/v1/sprints` & `/sprint-sessions`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/sprints` | Create new 1-on-1 sprint request | Student |
| `GET` | `/sprints/pool` | Browse open unclaimed sprint pool | Mentor |
| `POST` | `/sprints/:id/claim` | Claim open sprint request | Mentor |
| `PATCH` | `/sprint-sessions/propose` | Propose session time slot | Mentor |
| `POST` | `/sprint-sessions/:id/confirm` | Confirm session & hold credits in escrow | Student |
| `PATCH` | `/sprint-sessions/:id/complete` | Complete session & release credits | Mentor |
| `PATCH` | `/sprint-sessions/:id/cancel` | Cancel session (>1hr refund rule) | Student / Mentor |

### 👥 Cohorts & Cohort Sessions (`/api/v1/cohorts` & `/cohort-sessions`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/cohorts` | Create new cohort program | Mentor |
| `GET` | `/cohorts` | List published cohort programs | Public |
| `POST` | `/cohorts/:id/register` | Enroll in cohort program | Student |
| `POST` | `/cohort-sessions/cohort/:cohortId` | Add group session to cohort | Mentor |
| `GET` | `/cohort-sessions/cohort/:cohortId` | Get cohort sessions (Gated access) | Public / Student |
| `POST` | `/cohort-sessions/:id/join` | Join cohort session (Credit escrow) | Student |
| `PATCH` | `/cohort-sessions/:id/complete` | Complete session & release payouts | Mentor |

### 🧑‍💻 Code Review Marketplace (`/api/v1/code-reviews`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/` | Create QUICK / DEEP code review request | Student |
| `GET` | `/pool` | Browse open code review requests pool | Mentor |
| `POST` | `/:id/preview` | Acquire 10-minute exclusive preview lock | Mentor |
| `POST` | `/:id/claim` | Claim review request & start SLA timer | Mentor |
| `POST` | `/:id/submit` | Submit review feedback & line comments | Mentor |
| `PATCH` | `/:id/approve` | Approve review & release 100% credits | Student / Admin |
| `DELETE` | `/:id/cancel` | Cancel open request & refund credits | Student |

### 📝 Exams & Quizzes (`/api/v1/exams`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/` | Create new exam (DRAFT mode) | Mentor |
| `POST` | `/:examId/questions` | Add/Bulk upload MCQ questions | Mentor |
| `PATCH` | `/:examId/publish` | Publish exam for students | Mentor |
| `GET` | `/mentor/my-exams` | Get mentor's created exams | Mentor |
| `GET` | `/` | Browse available exams | Student |
| `GET` | `/:examId/start` | Start exam attempt (Sanitized payload) | Student |
| `POST` | `/:examId/submit` | Submit answers & auto-evaluate | Student |
| `GET` | `/me/attempts` | Get student past attempt history | Student |

### 🎓 Student Enrollments (`/api/v1/enrollments`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `GET` | `/my-cohorts` | Get student's enrolled cohorts | Student |
| `GET` | `/my-sprints` | Get student's enrolled sprints | Student |

### 📁 Asset Uploads (`/api/v1/upload`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/` | Stream upload file/image to Cloudinary CDN | Authenticated |

### 💳 Payments & Wallet (`/api/v1/payments`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/top-up` | Initiate bKash credit top-up | Student |
| `GET/POST`| `/bkash/callback` | bKash IPN redirect callback handler | Public |
| `GET` | `/wallet/me` | Get credit balance & transaction ledger | Authenticated |
| `GET` | `/history` | Get payment invoice history | Authenticated |
| `POST` | `/withdraw` | Request bKash withdrawal cash-out | Mentor / Admin |

### 🛡️ Admin Governance (`/api/v1/admin`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `GET` | `/users` | Get paginated user directory | Admin |
| `PATCH` | `/users/:id/block` | Toggle user account block status | Admin |
| `PATCH` | `/mentors/:id/approve` | Approve or reject mentor application | Admin |
| `PATCH` | `/cohorts/:id/approve` | Approve or reject cohort program | Admin |

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js**: `v20.x` or higher
- **PostgreSQL**: Local instance or cloud database (Prisma Postgres / Supabase / Neon)
- **Cloudinary**: Cloud name, API Key, and Secret

### Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/Zihad-1883/L2-A6-DevMentor-Server.git
cd L2-A6-DevMentor-Server

# 2. Install dependencies (runs prisma generate automatically)
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Push database schema & generate client
npx prisma db push

# 5. Seed initial admin account
npm run seed

# 6. Start development server with hot-reload
npm run dev
```

The server will start at `http://localhost:5000` with the health check available at `http://localhost:5000/api/v1/health`.

---

## 🔧 Environment Variables Reference

```env
# ── Server Config ─────────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# ── Database Connection ────────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@localhost:5432/devmentor?schema=public"

# ── Better Auth Configuration ──────────────────────────────────────────────────
BETTER_AUTH_SECRET="your-super-secret-key-min-32-chars"
BETTER_AUTH_URL="http://localhost:5000"

# ── Cloudinary CDN ─────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# ── bKash Payment Gateway Sandbox Credentials ──────────────────────────────────
BKASH_BASE_URL="https://tokenized.sandbox.bKash.com/v1.2.0-beta"
BKASH_USERNAME="sandbox-username"
BKASH_PASSWORD="sandbox-password"
BKASH_APP_KEY="sandbox-app-key"
BKASH_APP_SECRET="sandbox-app-secret"
BKASH_CALLBACK_URL="http://localhost:5000/api/v1/payments/bkash/callback"

# ── Nodemailer SMTP (Email Receipts) ──────────────────────────────────────────
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="DevMentor Receipts <noreply@devmentor.com>"
```

---

## 🧪 Postman Test Automation

A production-tested Postman collection is included in the root directory: **`DevMentor API.postman_collection.json`**.

### Features of the Collection:
- **Zero-Friction Auth**: Pre-configured test login request automatically extracts the session token and saves it to collection variables.
- **Dynamic ID Auto-Capture**: Requests automatically save generated IDs (`sprintId`, `sessionId`, `cohortId`, `reviewId`, `examId`, `userId`, `mentorId`) upon creation, allowing seamless end-to-end flow execution without manual copying.
- **Date Automation**: All request bodies utilize dynamic future timestamps, preventing date validation errors.

---

## 👤 Author

**Zihad Ahmed**
- **GitHub**: [@Zihad-1883](https://github.com/Zihad-1883)
- **Repository**: [L2-A6-DevMentor-Server](https://github.com/Zihad-1883/L2-A6-DevMentor-Server)
- **Assignment**: Programming Hero Level 2 — Assignment 6 (DevMentor Backend Engine)

---

<p align="center">
  <sub>Built with ❤️ for DevMentor Marketplace Platform. All rights reserved.</sub>
</p>
