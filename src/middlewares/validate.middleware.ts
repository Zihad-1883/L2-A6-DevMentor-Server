import type { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";
import { AppError } from "../utils/apiError.js";

type Target = "body" | "query" | "params";

export const validate = (schema: ZodType, target: Target = "body") => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[target]);

        if (!result.success) {
            const errors = result.error.issues.map((e) => ({
                field: e.path.join("."),
                message: e.message,
            }));

            return next(new AppError("Validation failed", 400, errors));
        }

        req[target] = result.data;
        next();
    };
};
