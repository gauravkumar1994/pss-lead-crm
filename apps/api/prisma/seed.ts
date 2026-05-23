import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

/* -----------------------------------------------------------
 * PRODUCTION SEED — only what is REQUIRED for first login.
 * No demo leads, no fake sales users, no fake activities.
 * Runs on every Render deploy (`render:setup`), so it must be
 * idempotent (upsert) and create zero throwaway data.
 *
 * Default admin password is overridable via env var
 * `SEED_ADMIN_PASSWORD` so prod can set a strong one in Render.
 * --------------------------------------------------------- */

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const hash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {}, // never overwrite existing admin password after first deploy
    create: {
      userCode: "ADMIN001",
      username: "admin",
      passwordHash: hash,
      fullName: "System Admin",
      role: Role.ADMIN,
      department: "Management",
    },
  });

  // ---------------------------------------------------------------
  // One-time cleanup of legacy demo data from older seed versions.
  // Safe — only matches the specific demo lead codes we used to seed
  // ("L-DEMO-001", "L-DEMO-002"). Schema has onDelete: Cascade on
  // activities + call_logs, so deleting these leads auto-cleans them.
  // ---------------------------------------------------------------
  const demoLeads = await prisma.lead.findMany({
    where: { leadCode: { startsWith: "L-DEMO-" } },
    select: { id: true },
  });
  if (demoLeads.length > 0) {
    const ids = demoLeads.map((l) => l.id);
    // CampaignRecipient FK is not cascaded — clean explicitly first
    await prisma.campaignRecipient.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    console.log(`[seed] Cleaned ${demoLeads.length} legacy demo lead(s).`);
  }

  // Seed only essential message templates (used by Quick Send UI),
  // skip if any templates already exist.
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

  console.log(
    `Seed complete. Admin login: admin / ${adminPassword === "admin123" ? "admin123 (change ASAP!)" : "(SEED_ADMIN_PASSWORD env)"}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
