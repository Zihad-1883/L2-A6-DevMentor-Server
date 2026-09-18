import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/apiError.js";

// Valid roles in the system
export type Role = "student" | "mentor" | "admin";

// requireRole("admin") or requireRole("admin", "mentor")
// Always use AFTER requireAuth — depends on req.user being set.
export const requireRole = (...roles: Role[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new AppError("Unauthorized: not authenticated", 401));
        }

        if (roles.length && !roles.includes(req.user.role as Role)) {
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
