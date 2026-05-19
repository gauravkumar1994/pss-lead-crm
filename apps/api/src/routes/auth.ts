import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: body.username } });
    if (!user || user.status !== "active") {
      return reply.status(401).send({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return reply.status(401).send({ error: "Invalid credentials" });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await reply.jwtSign({
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    });

    return {
      token,
      user: {
        id: user.id,
        userCode: user.userCode,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
      },
    };
  });

  app.get("/me", { onRequest: [app.authenticate] }, async (req) => {
    const u = req.user as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: u.id },
      select: {
        id: true,
        userCode: true,
        username: true,
        fullName: true,
        role: true,
        department: true,
        email: true,
        mobile: true,
      },
    });
    return { user };
  });
}
