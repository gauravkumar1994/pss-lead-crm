import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser } from "../lib/auth.js";

const schema = z.object({
  name: z.string().min(1),
  body: z.string().min(1),
  category: z.string().optional(),
});

export async function templateRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req) => {
    const user = getUser(req);
    const items = await prisma.messageTemplate.findMany({
      where: {
        OR: [{ userId: user.id }, { userId: null }],
      },
      orderBy: { name: "asc" },
    });
    return { items };
  });

  app.post("/", async (req) => {
    const user = getUser(req);
    const body = schema.parse(req.body);
    const row = await prisma.messageTemplate.create({
      data: {
        userId: user.id,
        name: body.name,
        body: body.body,
        category: body.category ?? "general",
      },
    });
    return row;
  });

  app.patch("/:id", async (req, reply) => {
    const user = getUser(req);
    const { id } = req.params as { id: string };
    const body = schema.partial().parse(req.body);
    const existing = await prisma.messageTemplate.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (existing.userId && existing.userId !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    return prisma.messageTemplate.update({ where: { id }, data: body });
  });

  app.delete("/:id", async (req, reply) => {
    const user = getUser(req);
    const { id } = req.params as { id: string };
    const existing = await prisma.messageTemplate.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (existing.userId && existing.userId !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    await prisma.messageTemplate.delete({ where: { id } });
    return { ok: true };
  });
}
