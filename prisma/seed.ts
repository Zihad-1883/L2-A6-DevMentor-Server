import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { auth } from "../src/lib/auth.js";

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin User ──────────────────────────────────────────────────────────────
  // Uses Better Auth's internal API to create user with properly hashed password.
  // These credentials are used for demo/submission — store safely.

  const adminEmail = "admin@kodex.dev";
  const adminPassword = "Admin@123456";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    await auth.api.signUpEmail({
      body: {
        name: "Kōdex Admin",
        email: adminEmail,
        password: adminPassword,
      },
    });

    // Better Auth creates user with role "student" by default — update to "admin"
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: "admin" },
    });

    console.log("✅ Admin user created");
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role:     admin`);
  } else {
    // Ensure existing user has admin role (idempotent re-run safety)
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: "admin" },
    });
    console.log("⚠️  Admin user already exists — role confirmed as admin");
  }

  console.log("\n✅ Seeding complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
