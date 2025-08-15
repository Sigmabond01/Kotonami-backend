import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import config from "./config2.js";
import { connectToDb } from './db.js';
import { connectMongoose } from './db.mongoose.js';
import authRoutes from "./routes/auth.js";
import { authLimiter } from "./middleware/rateLimiter.js";
import csurf from "csurf";

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
}));

await connectToDb();
await connectMongoose();

app.use("/api/auth", authLimiter);

app.use("/api/auth", authRoutes);

app.get("/api/protected", (req, res) => {
    res.json({ msg: "public protected example - put requireAuth middleware for real protection" });
});

const port = config.port;
app.listen(port, () => console.log(`Auth server running on ${port}`));
