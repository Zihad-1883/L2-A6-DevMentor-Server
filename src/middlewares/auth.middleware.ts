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
        isBlocked: boolean;
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

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isBlocked: true },
    });

    if (dbUser?.isBlocked) {
      res.status(403).json({
        success: false,
        message: "Forbidden: Your account has been blocked by an administrator",
        errors: [],
      });
      return;
    }

    const userRole = dbUser?.role || (session.user as { role?: string }).role || "student";

    req.user = {
      ...(session.user as Record<string, unknown>),
      role: userRole,
      isBlocked: dbUser?.isBlocked || false,
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

