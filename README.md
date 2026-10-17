# DevMentor — Backend API Engine & Core Marketplace Services

[![Express.js](https://img.shields.io/badge/Express-5.2-black?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-v7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![bKash](https://img.shields.io/badge/bKash-Payment%20Gateway-D12053?style=for-the-badge)](https://developer.bKash.com/)

DevMentor Backend Engine is an enterprise-grade RESTful API orchestrating a credit-based mentorship marketplace, asynchronous code review escrow, cohort course management, and multi-provider AI analysis. Designed around concurrency-safe Prisma transactions and resilient LLM fallback engines.

---

## 🌐 Live Deployments & Key Resources

| Resource | URL / Link | Description |
|---|---|---|
| **Production API Base URL** | `https://dev-mentor-server.vercel.app/api/v1` | Live API deployed on Vercel Edge Serverless |
| **Health Check Endpoint** | [`GET /api/v1/health`](https://dev-mentor-server.vercel.app/api/v1/health) | Live system uptime & health check |
| **Frontend Web App** | [https://dev-mentor-client.vercel.app](https://dev-mentor-client.vercel.app) | Production Next.js 15 Client |
| **Published Postman Docs** | [Live Postman Documentation](https://documenter.getpostman.com/view/55049501/2sBYHNVhEw) | Interactive web documentation for all 70+ endpoints |
| **Backend GitHub Repository** | [Zihad-1883/L2-A6-DevMentor-Server](https://github.com/Zihad-1883/L2-A6-DevMentor-Server) | Complete server source code & schema |
| **Frontend GitHub Repository** | [Zihad-1883/L2-A7-DevMentor-Client](https://github.com/Zihad-1883/L2-A7-DevMentor-Client) | Complete Next.js client repository |
| **Postman Collection File** | [`DevMentor API.postman_collection.json`](./DevMentor%20API.postman_collection.json) | Exported Postman JSON collection file |

---

## 🔑 Demo Access Credentials

| Role | Email | Password | Access Rights |
|---|---|---|---|
| **Demo Student** | `student@devmentor.com` | `Student@123456` | Top-up DevCredits, book sprints, request code reviews, take MCQ exams |
| **Demo Mentor** | `mentor@devmentor.com` | `Mentor@123456` | Claim sprint proposals, host cohorts, review code, request bKash cash-out |
| **Demo Admin** | `admin@devmentor.com` | `Admin@123456` | Moderate users, verify mentors, approve cohorts, process payouts |

---

## 🚀 Core Features & Architecture

### 1. 🤖 Multi-Provider AI Intelligent Services (`/api/v1/ai`)
- **Dual-Provider Resilience Engine**: Calls **Groq (`qwen/qwen3.8-27b`)** and **Google Gemini 2.5 Flash** with automatic failover and deterministic static rule fallbacks for guaranteed zero-crash uptime.
- **`POST /api/v1/ai/chat`**: Grounded platform assistant & FAQ chatbot with verified platform rules, pricing parity, and dynamic suggested chips.
- **`POST /api/v1/ai/match`**: Smart Matcher querying active database mentors & cohorts to return compatibility score badges (e.g. `95% Match`) and personalized reasoning.
- **`POST /api/v1/ai/code-scan`**: Automated Code Review Pre-Scan computing Maintainability Scores (1–100), Time/Space complexity, and categorizing findings (`critical`, `warning`, `suggestion`).

### 2. 💰 DevCredits Escrow Economy & bKash Gateway (`/api/v1/payments`)
- **Virtual Parity**: `1 DevCredit = ৳4.00 BDT`.
- **bKash Tokenized Checkout API**: Instant wallet credit allotment via secure webhooks and callback validation.
- **Escrow Settlement**: Credits are locked upon booking and disbursed to mentors only after verified milestone delivery or student approval.
- **Automated PDF Invoices**: Generates professional transaction receipts using **PDFKit** and sends them via **Nodemailer SMTP**.
- **Mentor Cash-Out**: Verified mentors request withdrawal directly to their bKash numbers.

### 3. 🧑‍💻 Code Review Escrow Marketplace (`/api/v1/code-reviews`)
- **Two Service Tiers**: QUICK (10 Cr / 2h SLA) and DEEP (50 Cr / 24h SLA).
- **10-Minute Exclusive Preview Lock**: Prevents race conditions by locking a code review ticket to one mentor during inspection.
- **Inline Code Comments**: Structured line-by-line annotations and refactored code diff storage.

### 4. 🎯 1-on-1 Mentorship Sprints (`/api/v1/sprints` & `/sprint-sessions`)
- Student direct requests or open pool broadcast.
- Flexible pricing per selected session (`selectedDays.length * 50 Credits`).
- Conflict-aware scheduling and daily milestone checklist tracking.

### 5. 📚 Curated Batch Cohorts (`/api/v1/cohorts` & `/cohort-sessions`)
- Mentor-created bootcamps with modular session pricing.
- Gated media access protection, session recordings, and student homework submission.

### 6. 🏆 Online Exam Engine & Assessments (`/api/v1/exams`)
- MCQ question bank management with automated grading and passing thresholds.
- Sanitized question payloads preventing answer leakage to students during attempts.
- Verifiable skill badges issued upon passing.

### 7. 🛡️ Role-Based Access Control (RBAC) & Governance (`/api/v1/auth`, `/users`, `/admin`)
- Session management via **Better-Auth** with PostgreSQL persistence and Redis secondary caching.
- Admin dashboard APIs for platform analytics, user moderation, and financial settlement logs.

---

## 🛠️ Main Technologies Used

| Technology | Purpose |
|---|---|
| **Node.js (v20+)** | High-performance asynchronous JavaScript runtime |
| **TypeScript (v7)** | Strict type-safety and contract validation across all modules |
| **Express.js (v5.2)** | RESTful web API framework with modular routing and middleware |
| **Prisma ORM (v7.1)** | Database client with atomic multi-table transactions (`$transaction`) |
| **PostgreSQL (v16)** | ACID-compliant relational persistence for users, escrow, and cohorts |
| **Better-Auth** | Secure session management, email OTP verification, and Google OAuth |
| **Upstash Redis** | Secondary session caching and rate-limiting storage |
| **bKash API** | Tokenized merchant checkout integration for Bangladeshi Taka (BDT) |
| **Groq & Google Gemini** | AI inference engines powering smart matchmaking and code analysis |
| **Cloudinary** | Cloud CDN media storage for avatars, resumes, and code snippets |
| **PDFKit & Nodemailer** | Automated PDF invoice rendering and SMTP email dispatch |
| **Zod (v4)** | Strict request body, param, and query validation schemas |

---

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "express": "^5.2.1",
    "@prisma/client": "^7.10.0",
    "better-auth": "^1.7.5",
    "@better-auth/prisma-adapter": "^1.7.5",
    "@upstash/redis": "^1.38.4",
    "pg": "^8.23.0",
    "zod": "^4.6.5",
    "cloudinary": "^2.11.0",
    "pdfkit": "^0.20.2",
    "nodemailer": "^10.0.10",
    "node-cron": "^4.6.0",
    "cors": "^2.8.6",
    "helmet": "^8.3.0",
    "dotenv": "^17.4.2"
  },
  "devDependencies": {
    "prisma": "^7.10.0",
    "typescript": "^7.0.2",
    "tsx": "^4.23.13",
    "tsup": "^8.5.1"
  }
}
```

---

## ⚙️ Step-by-Step Local Development Setup

Follow these instructions to run the backend engine on your local development machine:

### 1. Clone the Repository
```bash
git clone https://github.com/Zihad-1883/L2-A6-DevMentor-Server.git
cd L2-A6-DevMentor-Server
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
# ── Server Config ──
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# ── Database Connection ──
DATABASE_URL="postgresql://postgres:password@localhost:5432/devmentor?schema=public"

# ── Better Auth ──
BETTER_AUTH_SECRET="your-32-character-secret-key-goes-here"
BETTER_AUTH_URL="http://localhost:5000"

# ── AI API Keys ──
GROQ_API_KEY="your-groq-api-key"
GEMINI_API_KEY="your-google-gemini-api-key"

# ── Cloudinary CDN ──
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# ── bKash Sandbox (Optional for local test) ──
BKASH_BASE_URL="https://tokenized.sandbox.bKash.com/v1.2.0-beta"
BKASH_USERNAME="sandbox-user"
BKASH_PASSWORD="sandbox-password"
BKASH_APP_KEY="sandbox-app-key"
BKASH_APP_SECRET="sandbox-app-secret"
BKASH_CALLBACK_URL="http://localhost:5000/api/v1/payments/bkash/callback"

# ── Nodemailer SMTP ──
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="DevMentor <noreply@devmentor.com>"
```

### 4. Push Database Schema & Seed Data
```bash
# Push Prisma schema to PostgreSQL
npx prisma db push

# Generate Prisma Client
npm run postinstall

# Seed initial admin, mentor, and student test accounts
npm run seed
```

### 5. Start Development Server
```bash
npm run dev
```

The server will boot with hot-reload at **`http://localhost:5000`**.  
Verify health by visiting: **`http://localhost:5000/api/v1/health`**

---

## 📋 Comprehensive API Route Directory

### 🤖 AI Intelligent Features (`/api/v1/ai`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/chat` | DevMentor Assistant & FAQ chatbot conversation | Public / Visitor |
| `POST` | `/match` | Smart AI mentor & cohort recommendation engine | Public / Visitor |
| `POST` | `/code-scan` | Automated code review pre-scan & complexity audit | Public / Student |

### 🔐 Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/sign-in/email` | Password login with session cookie | Public |
| `POST` | `/sign-up/email` | User registration with OTP dispatch | Public |
| `POST` | `/email-otp/verify-email` | Verify 6-digit registration OTP code | Public |
| `POST` | `/email-otp/send-verification-otp` | Resend verification OTP code | Public |
| `POST` | `/sign-out` | Destroy session & revoke tokens | Authenticated |

### 🧑‍🏫 Mentors Directory & Applications (`/api/v1/mentors`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/apply` | Submit mentor profile application | Student |
| `GET` | `/` | Browse verified mentors directory (Filters + Search) | Public |
| `GET` | `/:id` | View detailed public mentor profile | Public |
| `GET` | `/profile/me` | Fetch authenticated mentor's studio profile | Mentor |
| `PATCH` | `/profile/me` | Update mentor bio, pricing, and tech stack tags | Mentor |

### 🧑‍💻 Code Review Escrow Marketplace (`/api/v1/code-reviews`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/` | Submit QUICK (2h) or DEEP (24h) review request | Student |
| `GET` | `/pool` | Browse unclaimed open code review tickets | Mentor |
| `POST` | `/:id/preview` | Acquire 10-minute exclusive preview lock | Mentor |
| `POST` | `/:id/claim` | Claim review ticket & start SLA countdown | Mentor |
| `POST` | `/:id/submit` | Deliver review verdict, diffs, and inline notes | Mentor |
| `PATCH` | `/:id/approve` | Finalize review and release escrow credits | Student / Admin |
| `DELETE` | `/:id/cancel` | Cancel review ticket & refund student credits | Student |

### 🏃 1-on-1 Sprints (`/api/v1/sprints` & `/sprint-sessions`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/` | Create direct sprint request or broadcast to pool | Student |
| `GET` | `/pool` | View open pool of student sprint requests | Mentor |
| `POST` | `/:id/claim` | Claim sprint request and lock sessions | Mentor |
| `GET` | `/:id` | View sprint progress and milestone checklist | Student / Mentor |
| `PATCH` | `/sprint-sessions/:id/complete` | Complete milestone session & release payment | Mentor |

### 📚 Cohorts & Bootcamps (`/api/v1/cohorts` & `/cohort-sessions`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/` | Create new cohort curriculum track | Mentor |
| `GET` | `/` | Browse approved cohort programs | Public |
| `GET` | `/:id` | View cohort overview and curriculum syllabus | Public |
| `POST` | `/cohort-sessions/:id/join` | Enroll in specific modular cohort session | Student |
| `PATCH` | `/cohort-sessions/:id/complete` | Complete session & release mentor payout | Mentor |

### 💳 Payments & DevCredits Wallet (`/api/v1/payments`)
| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `GET` | `/wallet` | View current credit balance & transaction ledger | Authenticated |
| `POST` | `/top-up` | Initiate bKash payment token for credit purchase | Student |
| `GET` | `/bkash/callback` | bKash IPN callback & automated PDF receipt dispatch | Public |
| `POST` | `/cash-out` | Request credit withdrawal to personal bKash | Mentor |

---

## 👤 Author & Academic Context

**Zihad Ahmed**
- **GitHub**: [@Zihad-1883](https://github.com/Zihad-1883)
- **Program**: Programming Hero — Level 2 Web Engineering
- **Assignments**: Assignment 6 (Backend API) & Assignment 7 (Full-Stack Client)

---

<p align="center">
  <sub>Built with ❤️ for the DevMentor Engineering Ecosystem. All rights reserved.</sub>
</p>
