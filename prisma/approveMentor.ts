import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const email = "mentor@devmentor.com";

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`❌ User with email '${email}' not found. Please sign up first.`);
    process.exit(1);
  }

  // 1. Update user role to 'mentor'
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "mentor" },
  });

  // 2. Upsert MentorProfile with APPROVED status
  const mentorProfile = await prisma.mentorProfile.upsert({
    where: { userId: user.id },
    update: {
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
    },
    create: {
      userId: user.id,
      bio: "Senior Full-Stack Engineer & System Architecture Mentor",
      techStackTags: ["Node.js", "Express", "TypeScript", "PostgreSQL", "Prisma", "React"],
      experienceLevel: "SENIOR",
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
    },
  });

  console.log(`✅ User '${user.name}' (${user.email}) upgraded to mentor and profile APPROVED successfully!`);
  console.log(mentorProfile);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
