import type { FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";

export type JwtUser = {
  id: string;
  username: string;
  role: Role;
  fullName: string;
};

export function getUser(req: FastifyRequest): JwtUser {
  return req.user as JwtUser;
}

export function requireRoles(user: JwtUser, allowed: Role[]) {
  if (!allowed.includes(user.role)) {
    const err = new Error("Forbidden");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
}
