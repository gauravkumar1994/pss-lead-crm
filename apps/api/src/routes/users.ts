import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  role: z.nativeEnum(Role).default(Role.USER),
  department: z.string().optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN, Role.MANAGER]);
    const items = await prisma.user.findMany({
      where: { status: "active" },
      select: {
        id: true,
        userCode: true,
        username: true,
        fullName: true,
        role: true,
        department: true,
        email: true,
        mobile: true,
        lastLoginAt: true,
      },
      orderBy: { fullName: "asc" },
    });
    return { items };
  });

  app.post("/", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const body = createUserSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { username: body.username } });
    if (exists) return reply.status(409).send({ error: "Username taken" });

    const hash = await bcrypt.hash(body.password, 10);
    const created = await prisma.user.create({
      data: {
        userCode: `U${Date.now().toString(36).toUpperCase()}`,
        username: body.username,
        passwordHash: hash,
        fullName: body.fullName,
        email: body.email,
        mobile: body.mobile,
        role: body.role,
        department: body.department ?? "Sales",
      },
      select: {
        id: true,
        userCode: true,
        username: true,
        fullName: true,
        role: true,
      },
    });
    return created;
  });

  app.get("/active", async () => {
    const items = await prisma.user.findMany({
      where: { status: "active" },
      select: { id: true, fullName: true, userCode: true, role: true },
      orderBy: { fullName: "asc" },
    });
    return { items };
  });

  app.patch("/:id", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const { id } = req.params as { id: string };
    const body = createUserSchema.partial().parse(req.body);
    const { password, ...rest } = body;
    const data: Record<string, unknown> = { ...rest };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    const updated = await prisma.user.update({ where: { id }, data });
    return {
      id: updated.id,
      userCode: updated.userCode,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role,
    };
  });

  app.delete("/:id", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const { id } = req.params as { id: string };
    if (id === user.id) return reply.status(400).send({ error: "Cannot delete yourself" });
    await prisma.user.update({ where: { id }, data: { status: "inactive" } });
    return { ok: true };
  });
}
