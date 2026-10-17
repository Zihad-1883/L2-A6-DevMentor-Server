import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { auth } from "../src/lib/auth.js";

// Safe placeholder URLs that do not point to real external users or sites
const PLACEHOLDER_URL = "#";

async function getOrCreateUser(data: {
  name: string;
  email: string;
  password?: string;
  role: "student" | "mentor" | "admin";
  image?: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    // Preserve existing account without touching password
    return await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: data.role,
        ...(data.image && !existing.image ? { image: data.image } : {}),
      },
    });
  }

  // Create new user through better-auth so password hashing and auth accounts are aligned
  const signupResult = await auth.api.signUpEmail({
    body: {
      name: data.name,
      email: data.email,
      password: data.password || "Password@123456",
    },
  });

  const createdUser = await prisma.user.update({
    where: { email: data.email },
    data: {
      role: data.role,
      emailVerified: true,
      image: data.image || null,
    },
  });

  return createdUser;
}

async function ensureWallet(userId: string, initialBalance: number = 300) {
  return await prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      balance: initialBalance,
      totalEarned: 0,
      totalWithdrawn: 0,
      transactions: {
        create: {
          amount: initialBalance,
          type: "TOP_UP",
          description: "Initial platform onboarding credit allotment",
        },
      },
    },
  });
}

async function main() {
  console.log("🌱 Commencing Safe Multi-Entity Seeding for DevMentor...");

  // ─────────────────────────────────────────────────────────────
  // 1. PRESERVE & VERIFY 3 CORE DEMO ACCOUNTS (Untouched & Intact)
  // ─────────────────────────────────────────────────────────────
  console.log("🔒 Preserving & verifying 3 core demo accounts...");

  const admin = await getOrCreateUser({
    name: "DevMentor Admin",
    email: "admin@devmentor.com",
    role: "admin",
  });
  await ensureWallet(admin.id, 1000);

  const primaryMentor = await getOrCreateUser({
    name: "Mentor",
    email: "mentor@devmentor.com",
    role: "mentor",
  });
  await ensureWallet(primaryMentor.id, 500);

  const primaryStudent = await getOrCreateUser({
    name: "Student New",
    email: "student@devmentor.com",
    role: "student",
  });
  await ensureWallet(primaryStudent.id, 500);

  console.log("✅ Core 3 accounts confirmed safe and sound.");

  // ─────────────────────────────────────────────────────────────
  // 2. CREATE DIVERSE NEW MENTORS (Different Stacks & Levels)
  // ─────────────────────────────────────────────────────────────
  console.log("🧑‍🏫 Seeding diverse verified mentors...");

  const mentorsData = [
    {
      name: "Tariqul Islam",
      email: "tariqul.mentor@devmentor.com",
      role: "mentor" as const,
      level: "SENIOR" as const,
      bio: "Cloud Architect & Distributed Systems Specialist with 9+ years experience building microservices and high-scale Postgres clusters.",
      tags: ["Go", "Kubernetes", "PostgreSQL", "Docker", "Microservices", "gRPC"],
      githubUrl: PLACEHOLDER_URL,
      resumeUrl: PLACEHOLDER_URL,
    },
    {
      name: "Sultana Parveen",
      email: "sultana.mentor@devmentor.com",
      role: "mentor" as const,
      level: "SENIOR" as const,
      bio: "Principal AI & Machine Learning Engineer specializing in RAG architectures, LLM fine-tuning, and production FastAPI pipelines.",
      tags: ["Python", "FastAPI", "Machine Learning", "PyTorch", "Docker", "AI/ML"],
      githubUrl: PLACEHOLDER_URL,
      resumeUrl: PLACEHOLDER_URL,
    },
    {
      name: "Kamrul Hasan",
      email: "kamrul.mentor@devmentor.com",
      role: "mentor" as const,
      level: "MID" as const,
      bio: "Modern Full-Stack Web Engineer passionate about Next.js 15 App Router, React 19, TypeScript, and Prisma ORM optimization.",
      tags: ["Next.js", "TypeScript", "React", "PostgreSQL", "Prisma", "TailwindCSS"],
      githubUrl: PLACEHOLDER_URL,
      resumeUrl: PLACEHOLDER_URL,
    },
    {
      name: "Anika Tabassum",
      email: "anika.mentor@devmentor.com",
      role: "mentor" as const,
      level: "JUNIOR" as const,
      bio: "Frontend UI/UX Specialist crafting high-performance, accessible web interfaces with modern CSS, Tailwind, and React design systems.",
      tags: ["React", "JavaScript", "TailwindCSS", "CSS3", "UI/UX", "Next.js"],
      githubUrl: PLACEHOLDER_URL,
      resumeUrl: PLACEHOLDER_URL,
    },
  ];

  const seededMentors: any[] = [primaryMentor];

  for (const mData of mentorsData) {
    const user = await getOrCreateUser({
      name: mData.name,
      email: mData.email,
      password: "Mentor@123456",
      role: "mentor",
    });

    await ensureWallet(user.id, 400);

    const profile = await prisma.mentorProfile.upsert({
      where: { userId: user.id },
      update: {
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        bio: mData.bio,
        techStackTags: mData.tags,
        experienceLevel: mData.level,
        githubUrl: mData.githubUrl,
        resumeUrl: mData.resumeUrl,
      },
      create: {
        userId: user.id,
        bio: mData.bio,
        techStackTags: mData.tags,
        experienceLevel: mData.level,
        githubUrl: mData.githubUrl,
        resumeUrl: mData.resumeUrl,
        approvalStatus: "APPROVED",
        approvedBy: admin.id,
        approvedAt: new Date(),
      },
    });

    seededMentors.push(user);
    console.log(`   + Mentor seeded: ${user.name} (${mData.level} - ${mData.tags.slice(0, 3).join(", ")})`);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CREATE DIVERSE NEW STUDENTS
  // ─────────────────────────────────────────────────────────────
  console.log("🎓 Seeding active students...");

  const studentsData = [
    { name: "Sadia Rahman", email: "sadia.student@devmentor.com" },
    { name: "Tanvir Anjum", email: "tanvir.student@devmentor.com" },
    { name: "Nayeem Mahmud", email: "nayeem.student@devmentor.com" },
  ];

  const seededStudents: any[] = [primaryStudent];

  for (const sData of studentsData) {
    const user = await getOrCreateUser({
      name: sData.name,
      email: sData.email,
      password: "Student@123456",
      role: "student",
    });

    await ensureWallet(user.id, 350);
    seededStudents.push(user);
    console.log(`   + Student seeded: ${user.name}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. PUBLISHED & APPROVED COHORT PROGRAMS (Different Tech Stacks)
  // ─────────────────────────────────────────────────────────────
  console.log("📚 Seeding approved & published cohort bootcamps...");

  // Ensure primary mentor's existing cohorts are published if they were draft
  await prisma.cohortProgram.updateMany({
    where: {
      mentorId: primaryMentor.id,
      approvalStatus: "APPROVED",
      status: "DRAFT",
    },
    data: {
      status: "PUBLISHED",
    },
  });

  const cohortsToSeed = [
    {
      title: "Production AI Engineering: LLMs, LangChain & Vector Databases",
      description: "Master modern AI application development: embeddings, semantic search with Pinecone, building RAG systems with LangChain, and deploying high-throughput FastAPI inference microservices with Docker.",
      mentorId: seededMentors.find((m) => m.email === "sultana.mentor@devmentor.com")?.id || primaryMentor.id,
      durationWeeks: 6,
      capacity: 30,
      totalCost: 240,
      techStackTags: ["Python", "FastAPI", "Machine Learning", "Docker", "PyTorch"],
      sessions: [
        { sessionNumber: 1, dayNumber: 1, title: "LLM Fundamentals, Embeddings & Vector Stores", creditCost: 40 },
        { sessionNumber: 2, dayNumber: 7, title: "Building RAG Architectures with LangChain", creditCost: 40 },
        { sessionNumber: 3, dayNumber: 14, title: "Function Calling, Tools & Autonomous Agents", creditCost: 40 },
        { sessionNumber: 4, dayNumber: 21, title: "FastAPI Async Serving & Streaming Responses", creditCost: 40 },
        { sessionNumber: 5, dayNumber: 28, title: "Dockerizing & Cloud Deployment at Scale", creditCost: 40 },
        { sessionNumber: 6, dayNumber: 35, title: "Capstone Project: Production Knowledge Assistant", creditCost: 40 },
      ],
    },
    {
      title: "Distributed Microservices & Concurrency in Go",
      description: "An intensive systems engineering bootcamp: goroutines, channels, gRPC protocol buffers, event-driven streaming with Kafka, and Kubernetes container orchestration.",
      mentorId: seededMentors.find((m) => m.email === "tariqul.mentor@devmentor.com")?.id || primaryMentor.id,
      durationWeeks: 8,
      capacity: 20,
      totalCost: 320,
      techStackTags: ["Go", "Kubernetes", "PostgreSQL", "Docker", "Microservices"],
      sessions: [
        { sessionNumber: 1, dayNumber: 1, title: "Go Concurrency Patterns: Channels & Worker Pools", creditCost: 40 },
        { sessionNumber: 2, dayNumber: 7, title: "High-Performance gRPC Communication & Protobuf", creditCost: 40 },
        { sessionNumber: 3, dayNumber: 14, title: "Transactional Outbox Pattern & PostgreSQL Locking", creditCost: 40 },
        { sessionNumber: 4, dayNumber: 21, title: "Event Streaming with Apache Kafka", creditCost: 40 },
        { sessionNumber: 5, dayNumber: 28, title: "Distributed Tracing with OpenTelemetry", creditCost: 40 },
        { sessionNumber: 6, dayNumber: 35, title: "Kubernetes Deployments, Ingress & Helm Charts", creditCost: 40 },
      ],
    },
    {
      title: "Modern React 19, TailwindCSS & Design Systems Mastery",
      description: "Level up your UI engineering skills: React 19 hooks, component architecture, state machines, Tailwind v4 design tokens, and fluid Framer Motion animations.",
      mentorId: seededMentors.find((m) => m.email === "anika.mentor@devmentor.com")?.id || primaryMentor.id,
      durationWeeks: 4,
      capacity: 35,
      totalCost: 160,
      techStackTags: ["React", "TailwindCSS", "JavaScript", "UI/UX", "Next.js"],
      sessions: [
        { sessionNumber: 1, dayNumber: 1, title: "Design Systems & TailwindCSS Token Architecture", creditCost: 40 },
        { sessionNumber: 2, dayNumber: 7, title: "Advanced React 19 Patterns & Compound Components", creditCost: 40 },
        { sessionNumber: 3, dayNumber: 14, title: "Micro-Interactions, Layout Animations & SVG", creditCost: 40 },
        { sessionNumber: 4, dayNumber: 21, title: "Accessibility (a11y), Keyboard Navigation & Tests", creditCost: 40 },
      ],
    },
  ];

  for (const cData of cohortsToSeed) {
    const existingCohort = await prisma.cohortProgram.findFirst({
      where: { title: cData.title },
    });

    if (!existingCohort) {
      const createdCohort = await prisma.cohortProgram.create({
        data: {
          mentorId: cData.mentorId,
          title: cData.title,
          description: cData.description,
          durationWeeks: cData.durationWeeks,
          capacity: cData.capacity,
          totalCost: cData.totalCost,
          techStackTags: cData.techStackTags,
          approvalStatus: "APPROVED",
          status: "PUBLISHED",
          approvedBy: admin.id,
          approvedAt: new Date(),
          sessions: {
            create: cData.sessions.map((s) => ({
              sessionNumber: s.sessionNumber,
              dayNumber: s.dayNumber,
              title: s.title,
              scheduledAt: new Date(Date.now() + s.dayNumber * 24 * 60 * 60 * 1000),
              creditCost: s.creditCost,
              status: "CONFIRMED",
              joinLink: PLACEHOLDER_URL,
            })),
          },
        },
      });

      // Enroll sample students
      await prisma.cohortEnrollment.createMany({
        data: [
          { cohortId: createdCohort.id, studentId: primaryStudent.id },
          { cohortId: createdCohort.id, studentId: seededStudents[1].id },
        ],
        skipDuplicates: true,
      });

      console.log(`   + Cohort created & published: "${createdCohort.title}"`);
    } else {
      await prisma.cohortProgram.update({
        where: { id: existingCohort.id },
        data: {
          approvalStatus: "APPROVED",
          status: "PUBLISHED",
        },
      });
      console.log(`   * Cohort confirmed published: "${existingCohort.title}"`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. SEED MENTORSHIP SPRINTS (Broadcast + Assigned to Mentors)
  // ─────────────────────────────────────────────────────────────
  console.log("🏃 Seeding mentorship sprint requests...");

  const sprintsToSeed = [
    {
      title: "Debug Next.js 15 Server Actions Concurrency Desync",
      description: "Need guidance resolving race conditions between Next.js Server Actions and Prisma connection pooling under concurrent traffic.",
      techStackTags: ["Next.js", "TypeScript", "PostgreSQL", "Prisma"],
      studentId: primaryStudent.id,
      targetMentorId: primaryMentor.id,
      status: "IN_PROGRESS" as const,
      claimedByMentorId: primaryMentor.id,
      durationDays: 3,
      selectedDays: [1, 2, 3],
    },
    {
      title: "Architecture Review: FastAPI Microservice with Redis BullMQ",
      description: "Seeking a senior Python engineer to audit background worker pipeline, retry policies, and dead-letter queue handling.",
      techStackTags: ["Python", "FastAPI", "Docker", "Machine Learning"],
      studentId: seededStudents[1].id,
      targetMentorId: seededMentors.find((m) => m.email === "sultana.mentor@devmentor.com")?.id || null,
      status: "CLAIMED" as const,
      claimedByMentorId: seededMentors.find((m) => m.email === "sultana.mentor@devmentor.com")?.id || null,
      durationDays: 2,
      selectedDays: [1, 3],
    },
    {
      title: "Open Broadcast: Refactoring React State to Zustand with Persistence",
      description: "Looking for an experienced mentor to guide state management cleanup in a medium-sized React dashboard with local storage sync.",
      techStackTags: ["React", "JavaScript", "TailwindCSS"],
      studentId: seededStudents[2].id,
      targetMentorId: null, // Open to all mentors
      status: "PENDING_CLAIM" as const,
      claimedByMentorId: null,
      durationDays: 3,
      selectedDays: [1, 2, 4],
    },
    {
      title: "Open Broadcast: Go Concurrency Deadlock in Distributed Worker",
      description: "Need help diagnosing a channel deadlock issue in our Go worker pool handling streaming analytics.",
      techStackTags: ["Go", "Microservices", "PostgreSQL", "Docker"],
      studentId: primaryStudent.id,
      targetMentorId: null, // Open to all mentors
      status: "PENDING_CLAIM" as const,
      claimedByMentorId: null,
      durationDays: 2,
      selectedDays: [1, 2],
    },
  ];

  for (const sData of sprintsToSeed) {
    const existing = await prisma.sprintRequest.findFirst({
      where: { title: sData.title },
    });

    if (!existing) {
      const createdSprint = await prisma.sprintRequest.create({
        data: {
          studentId: sData.studentId,
          title: sData.title,
          description: sData.description,
          techStackTags: sData.techStackTags,
          startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          durationDays: sData.durationDays,
          selectedDays: sData.selectedDays,
          status: sData.status,
          targetMentorId: sData.targetMentorId,
          claimedByMentorId: sData.claimedByMentorId,
          claimedAt: sData.claimedByMentorId ? new Date() : null,
          sessions: {
            create: sData.selectedDays.map((day) => ({
              dayNumber: day,
              scheduledAt: new Date(Date.now() + day * 24 * 60 * 60 * 1000),
              durationMinutes: 60,
              creditCost: 50,
              status: sData.status === "IN_PROGRESS" ? "CONFIRMED" : "PENDING",
              joinLink: PLACEHOLDER_URL,
            })),
          },
        },
      });
      console.log(`   + Sprint created: "${createdSprint.title}" (${sData.status})`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. SEED CODE REVIEWS (Quick 10 Cr & Deep 50 Cr across states)
  // ─────────────────────────────────────────────────────────────
  console.log("🔍 Seeding code review marketplace requests...");

  const codeReviewsToSeed = [
    {
      title: "Memory Leak & Unsubscribe in React useEffect Event Listener",
      description: "My window resize listener is causing repeated re-renders and memory growth in production. Need a quick turnaround review.",
      tier: "QUICK" as const,
      language: "typescript",
      creditReward: 10,
      status: "OPEN" as const,
      studentId: primaryStudent.id,
      assignedMentorId: null,
      githubRepoUrl: PLACEHOLDER_URL,
      codeSnippet: `import { useEffect, useState } from 'react';

export function WindowTracker() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    // Missing return cleanup function causes memory leak
  }, []);

  return <div>Viewport Width: {width}px</div>;
}`,
    },
    {
      title: "N+1 Query Bottleneck in FastAPI & SQLAlchemy Async Route",
      description: "Deep audit needed: Our order details endpoint takes 2.4s due to nested relationship queries without eager loading.",
      tier: "DEEP" as const,
      language: "python",
      creditReward: 50,
      status: "OPEN" as const,
      studentId: seededStudents[1].id,
      assignedMentorId: null,
      githubRepoUrl: PLACEHOLDER_URL,
      codeSnippet: `@app.get("/orders/{order_id}")
async def get_order_details(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    
    # N+1 bottleneck: looping over items triggers separate SQL calls
    items_data = []
    for item in order.items:
        items_data.append({
            "product_id": item.product_id,
            "product_name": item.product.name,
            "quantity": item.quantity
        })
    return {"order": order.id, "items": items_data}`,
    },
    {
      title: "Prisma $transaction Isolation & Deadlock Audit in Payment Flow",
      description: "Reviewed and delivered: Checked wallet decrement vs escrow transaction order with strict retry handling.",
      tier: "DEEP" as const,
      language: "typescript",
      creditReward: 50,
      status: "DELIVERED" as const,
      studentId: seededStudents[2].id,
      assignedMentorId: primaryMentor.id,
      githubRepoUrl: PLACEHOLDER_URL,
      codeSnippet: `export async function transferCredits(senderId: string, receiverId: string, amount: number) {
  return await prisma.$transaction(async (tx) => {
    const sender = await tx.wallet.update({
      where: { userId: senderId },
      data: { balance: { decrement: amount } }
    });
    const receiver = await tx.wallet.update({
      where: { userId: receiverId },
      data: { balance: { increment: amount } }
    });
    return { sender, receiver };
  });
}`,
    },
  ];

  for (const crData of codeReviewsToSeed) {
    const existing = await prisma.codeReviewRequest.findFirst({
      where: { title: crData.title },
    });

    if (!existing) {
      const createdReview = await prisma.codeReviewRequest.create({
        data: {
          studentId: crData.studentId,
          tier: crData.tier,
          title: crData.title,
          description: crData.description,
          codeSnippet: crData.codeSnippet,
          language: crData.language,
          creditReward: crData.creditReward,
          status: crData.status,
          assignedMentorId: crData.assignedMentorId,
          githubRepoUrl: crData.githubRepoUrl,
          ...(crData.status === "DELIVERED"
            ? {
                deliveryDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
                submission: {
                  create: {
                    mentorId: crData.assignedMentorId!,
                    summary: "Great initial implementation! Fixed potential race condition by asserting balance non-negativity constraint and wrapped with retry logic.",
                    reviewedCodeSnippet: `// Verified production refactor with positive balance assertion\nif (sender.balance < 0) throw new Error("Insufficient funds");`,
                  },
                },
              }
            : {}),
        },
      });
      console.log(`   + Code Review created: "${createdReview.title}" (${crData.status})`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 7. SEED ONLINE ASSESSMENTS & MCQ QUESTION BANKS (Published)
  // ─────────────────────────────────────────────────────────────
  console.log("🏆 Seeding published MCQ skill benchmark exams...");

  const examsToSeed = [
    {
      title: "TypeScript Mastery & Type-Level Programming Benchmark",
      description: "Assess your mastery of advanced TypeScript: conditional types, mapped types, distributive unions, and template literal types.",
      mentorId: primaryMentor.id,
      durationMinutes: 20,
      passMark: 60,
      status: "PUBLISHED" as const,
      isFree: true,
      questions: [
        {
          questionText: "Which utility type extracts the return type of a function type T?",
          options: ["ReturnType<T>", "ExtractReturn<T>", "TypeReturn<T>", "InferReturn<T>"],
          correctOptionIndex: 0,
          explanation: "ReturnType<T> is TypeScript's built-in utility type that constructs a type consisting of the return type of function type T.",
          marks: 1,
        },
        {
          questionText: "What does the 'keyof' operator produce when applied to an object type?",
          options: [
            "An array of string values",
            "A union of string or numeric literal types representing the keys",
            "A boolean indicating if keys exist",
            "A Map of key-value pairs",
          ],
          correctOptionIndex: 1,
          explanation: "The keyof operator takes an object type and produces a string or numeric literal union of its keys.",
          marks: 1,
        },
        {
          questionText: "In TypeScript, what is the key difference between 'type' and 'interface'?",
          options: [
            "Interfaces cannot define function signatures",
            "Types can represent primitive unions, whereas interfaces support declaration merging",
            "Types only work with classes",
            "There is no difference whatsoever",
          ],
          correctOptionIndex: 1,
          explanation: "Interfaces allow declaration merging (re-opening), while type aliases can name unions, tuples, and primitives.",
          marks: 1,
        },
        {
          questionText: "What happens when you use 'as const' on an array literal [1, 2, 3]?",
          options: [
            "It turns the array into a Set",
            "It freezes the JavaScript runtime object via Object.freeze",
            "It gives the expression a readonly tuple type with literal values [1, 2, 3]",
            "It converts numbers to strings",
          ],
          correctOptionIndex: 2,
          explanation: "Const assertions signal to TypeScript that literal types should not be widened, resulting in a readonly tuple type.",
          marks: 1,
        },
      ],
    },
    {
      title: "React 19 & Next.js 15 App Router Architecture",
      description: "Benchmark your understanding of React Server Components (RSC), Server Actions, Suspense boundaries, and hydration mechanics.",
      mentorId: seededMentors.find((m) => m.email === "kamrul.mentor@devmentor.com")?.id || primaryMentor.id,
      durationMinutes: 25,
      passMark: 60,
      status: "PUBLISHED" as const,
      isFree: true,
      questions: [
        {
          questionText: "What distinguishes a React Server Component (RSC) from a Client Component?",
          options: [
            "RSCs render only on the browser using WebAssembly",
            "RSCs execute exclusively on the server and their code bundle is never shipped to the client browser",
            "RSCs cannot fetch database records",
            "RSCs require using useState and useEffect hooks",
          ],
          correctOptionIndex: 1,
          explanation: "RSCs execute strictly on the server and emit serialized Virtual DOM, reducing JavaScript bundle size to zero for that component.",
          marks: 1,
        },
        {
          questionText: "How do you define a Server Action in Next.js 15 inside a file?",
          options: [
            "By writing @serverAction at the top",
            "By adding the 'use server' directive at the top of the function or file",
            "By registering it in next.config.js",
            "By importing serverAction from 'next/action'",
          ],
          correctOptionIndex: 1,
          explanation: "The 'use server' directive marks a file or async function as a callable Server Action.",
          marks: 1,
        },
        {
          questionText: "What does Next.js App Router use to isolate slow data fetching without blocking page paint?",
          options: [
            "Web Workers",
            "React Suspense boundaries with loading.tsx skeletons",
            "CSS display: none",
            "window.setTimeout",
          ],
          correctOptionIndex: 1,
          explanation: "Suspense boundaries allow streaming HTML chunks so instant fallback skeletons are rendered while data streams in.",
          marks: 1,
        },
      ],
    },
    {
      title: "Python, FastAPI & Asynchronous Concurrency",
      description: "Test your skills in asyncio event loops, Pydantic v2 data serialization, and high-performance FastAPI endpoint design.",
      mentorId: seededMentors.find((m) => m.email === "sultana.mentor@devmentor.com")?.id || primaryMentor.id,
      durationMinutes: 20,
      passMark: 60,
      status: "PUBLISHED" as const,
      isFree: true,
      questions: [
        {
          questionText: "What happens if you run a blocking, CPU-intensive function directly inside an async def route in FastAPI?",
          options: [
            "FastAPI automatically offloads it to a background thread pool",
            "It blocks the entire single-threaded asyncio event loop, stalling concurrent requests",
            "Python raises a CoroutineError exception",
            "FastAPI creates a separate worker process",
          ],
          correctOptionIndex: 1,
          explanation: "In an async def function, blocking calls block the event loop. To avoid this, standard def routes should be used so FastAPI runs them in its threadpool.",
          marks: 1,
        },
        {
          questionText: "Which library powers request parsing, validation, and serialization in FastAPI?",
          options: ["Marshmallow", "Pydantic", "Schema", "Cerberus"],
          correctOptionIndex: 1,
          explanation: "FastAPI is built tightly on Pydantic for data parsing, type validation, and OpenAPI schema generation.",
          marks: 1,
        },
      ],
    },
  ];

  for (const eData of examsToSeed) {
    const existing = await prisma.exam.findFirst({
      where: { title: eData.title },
    });

    if (!existing) {
      const createdExam = await prisma.exam.create({
        data: {
          mentorId: eData.mentorId,
          title: eData.title,
          description: eData.description,
          durationMinutes: eData.durationMinutes,
          passMark: eData.passMark,
          status: "PUBLISHED",
          isFree: true,
          totalQuestions: eData.questions.length,
          totalMarks: eData.questions.reduce((sum, q) => sum + q.marks, 0),
          questions: {
            create: eData.questions.map((q) => ({
              questionText: q.questionText,
              options: q.options,
              correctOptionIndex: q.correctOptionIndex,
              explanation: q.explanation,
              marks: q.marks,
            })),
          },
        },
      });

      // Seed a sample passed attempt for Demo Student on the first exam
      if (eData.title.includes("TypeScript")) {
        await prisma.examAttempt.create({
          data: {
            examId: createdExam.id,
            studentId: primaryStudent.id,
            score: 4,
            percentage: 100,
            isPassed: true,
            submittedAt: new Date(),
            answers: [
              { questionIndex: 0, selectedOption: 0, isCorrect: true },
              { questionIndex: 1, selectedOption: 1, isCorrect: true },
              { questionIndex: 2, selectedOption: 1, isCorrect: true },
              { questionIndex: 3, selectedOption: 2, isCorrect: true },
            ],
          },
        });
      }

      console.log(`   + Exam created & published: "${createdExam.title}" (${eData.questions.length} questions)`);
    } else {
      await prisma.exam.update({
        where: { id: existing.id },
        data: { status: "PUBLISHED" },
      });
      console.log(`   * Exam confirmed published: "${existing.title}"`);
    }
  }

  console.log("\n🎉 Complete Marketplace Seeding Finished Successfully!");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("Core accounts preserved intact:");
  console.log("  • admin@devmentor.com   (Admin@123456)");
  console.log("  • mentor@devmentor.com  (Mentor@123456)");
  console.log("  • student@devmentor.com (Student@123456)");
  console.log("─────────────────────────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
