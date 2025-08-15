import dotenv from "dotenv";
dotenv.config();

export default {
    port:process.env.PORT || 4000,
    nodeenv: process.env.NODE_ENV || "development",
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    accessTokenExpires: process.env.ACCESS_TOKEN_EXPIRES || "15m",
    refreshTokenExpiresDays: Number(process.env.ACCESS_TOKEN_EXPIRES_DAYS || 30),
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
    corsOrigin: process.env.CORS_ORIGIN || "https://localhost:3000",
};