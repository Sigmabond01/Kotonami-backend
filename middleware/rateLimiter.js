import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 100,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});