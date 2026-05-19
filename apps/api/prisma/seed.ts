import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      userCode: "ADMIN001",
      username: "admin",
      passwordHash: hash,
      fullName: "System Admin",
      role: Role.ADMIN,
      department: "Management",
    },
  });

  const salesHash = await bcrypt.hash("sales123", 10);
  await prisma.user.upsert({
    where: { username: "sales1" },
    update: {},
    create: {
      userCode: "SALES001",
      username: "sales1",
      passwordHash: salesHash,
      fullName: "Sales Executive 1",
      role: Role.USER,
      department: "Sales",
    },
  });

  const count = await prisma.lead.count();
  if (count === 0) {
    const sales = await prisma.user.findUnique({ where: { username: "sales1" } });
    await prisma.lead.createMany({
      data: [
        {
          leadCode: "L-DEMO-001",
          name: "Rahul Sharma",
          mobile: "9876543210",
          city: "Delhi",
          leadSource: "Website",
          assignedUserId: sales?.id,
          createdBy: admin.id,
        },
        {
          leadCode: "L-DEMO-002",
          name: "Priya Patel",
          mobile: "9123456780",
          city: "Mumbai",
          leadSource: "Referral",
          assignedUserId: sales?.id,
          createdBy: admin.id,
        },
      ],
    });
  }

  const tplCount = await prisma.messageTemplate.count();
  if (tplCount === 0) {
    await prisma.messageTemplate.createMany({
      data: [
        {
          name: "Introduction",
          body: "Hi {name}, this is from PSS. We received your enquiry. How can we help you today?",
          category: "sales",
        },
        {
          name: "Follow-up",
          body: "Hello {name}, following up on our last conversation. Please let us know a convenient time to connect.",
          category: "followup",
        },
        {
          name: "Offer",
          body: "Dear {name}, we have a special offer for you this week. Reply YES for details.",
          category: "promo",
        },
        {
          name: "Thank you",
          body: "Thank you {name} for choosing us. For support call us anytime.",
          category: "general",
        },
      ],
    });
  }

  console.log("Seed complete. Login: admin / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
