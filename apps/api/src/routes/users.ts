import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";

const optStr = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().optional()
);

const optEmail = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().email().optional()
);

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  fullName: z.string().min(1),
  email: optEmail,
  mobile: optStr,
  role: z.nativeEnum(Role).default(Role.USER),
  department: z.string().optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: optEmail,
  mobile: optStr,
  role: z.nativeEnum(Role).optional(),
  department: z.string().optional(),
  password: z.string().min(6).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN, Role.MANAGER]);
    const items = await prisma.user.findMany({
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        userCode: true,
        username: true,
        fullName: true,
        role: true,
        department: true,
        email: true,
        mobile: true,
        status: true,
        lastLoginAt: true,
      },
    });
    return { items };
  });

  app.post("/", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const body = createUserSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { username: body.username } });
    if (exists) return reply.status(409).send({ error: "Username already taken" });

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
        status: "active",
      },
      select: {
        id: true,
        userCode: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
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

  app.post("/:id/activate", async (req) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const { id } = req.params as { id: string };
    const updated = await prisma.user.update({
      where: { id },
      data: { status: "active" },
      select: { id: true, status: true },
    });
    return updated;
  });

  app.patch("/:id", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const { id } = req.params as { id: string };
    const body = updateUserSchema.parse(req.body);

    // Self-protection: admin cannot demote/deactivate himself (avoid lockout)
    if (id === user.id) {
      if (body.role && body.role !== Role.ADMIN) {
        return reply.status(400).send({ error: "You cannot change your own admin role" });
      }
      if (body.status && body.status !== "active") {
        return reply.status(400).send({ error: "You cannot deactivate yourself" });
      }
    }

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
      status: updated.status,
    };
  });

  app.delete("/:id", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const { id } = req.params as { id: string };
    if (id === user.id) return reply.status(400).send({ error: "Cannot deactivate yourself" });
    await prisma.user.update({ where: { id }, data: { status: "inactive" } });
    return { ok: true, status: "inactive" };
  });

}
