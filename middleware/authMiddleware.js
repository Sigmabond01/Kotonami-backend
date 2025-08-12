import jwt from "jsonwebtoken";
import config from "../CONFIG.JS";

export const requireAuth = (req, res, next) => {
    const auth = req.headers.authorization;
    if(!auth || !auth.startsWith("Bearer"))
        return res.status(401).json({
            message: "Unauthorized"
    });
    const token = auth.split(" ")[1];
    try {
        const payload = jwt.verify(token, config.accessTokenSecret);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};