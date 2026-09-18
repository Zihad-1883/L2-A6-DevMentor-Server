import type { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: string;
        emailVerified: boolean;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}


export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as unknown as Headers,
    });

    if (!session?.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: missing or invalid token",
        errors: [],
      });
      return;
    }

    let userRole = (session.user as { role?: string }).role;

    if (!userRole) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      userRole = dbUser?.role || "student";
    }

    req.user = {
      ...(session.user as Record<string, unknown>),
      role: userRole,
    } as Request["user"];

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Unauthorized: token verification failed",
      errors: [],
    });
  }
};
