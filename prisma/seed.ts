import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { auth } from "../src/lib/auth.js";

async function main() {
  console.log("🌱 Seeding database...");

  const adminEmail = "admin@devmentor.com";
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

    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: "admin" },
    });

    console.log("✅ Admin user created");
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role:     admin`);
  } else {
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
