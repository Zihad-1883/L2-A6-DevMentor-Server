import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/apiError.js";

export type Role = "student" | "mentor" | "admin";

export const requireRole = (...roles: Role[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new AppError("Unauthorized: not authenticated", 401));
        }

        const userRole = (req.user.role || "").toLowerCase();
        const allowedRoles = roles.map((r) => r.toLowerCase());

        if (roles.length && !allowedRoles.includes(userRole)) {
            return next(
                new AppError(
                    `Forbidden: requires role ${roles.join(" or ")}`,
                    403,
                ),
            );
        }

        next();
    };
};
