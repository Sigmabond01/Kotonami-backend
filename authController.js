import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import config from "../config.js";
import { validationResult } from "express-validator";
import { v4 as uuidv4 } from "uuid";

//helpers
function signAccessToken(user) {
  return jwt.sign({ sub: user._id, email: user.email }, config.accessTokenSecret, {
    expiresIn: config.accessTokenExpires,
  });
}

function genRefreshTokenRaw() {
    return crypto.randomBytes(64).toString("hex");
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export const register = async (req, res) => {
    //This line uses a library like express-validator to check if the incoming request data (e.g., email format, password length) meets predefined rules.
    const errors = validationResult(req);
    if(!errors.isEmpty())
        return res.status(400).json({
    errors: errors.array() 
    });
    const {email, password, name } = req.body;
    const existing = await User.findOne({ email });
    if(existing) return res.status(409).json({ message: "Email already in use!"});

    //This retrieves the number of "salt rounds" from a configuration file. Salt rounds determine how complex the password hashing process is. A higher number is more secure but slower.
    const saltRounds = config.bcryptSaltRounds;
    //The user's plain-text password is hashed using the bcrypt library.
    const hashed = await bcrypt.hash(password, saltRounds);

    const user = await User.create({email, password: hashed, name});
    const accessToken = signAccessToken(user);

    //create refresh token and set cookie
    const refreshRaw = genRefreshTokenRaw();
    const refreshHash = hashToken(refreshRaw);
    //This calculates the exact expiration date and time for the refresh token based on the number of days specified in your configuration.
    const expiresAt = new Date(Date.now() + config.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);
    
    await RefreshToken.create({
        tokenHash: refreshHash,
        user: user._id,
        expiresAt,
    });

    //send cookie
    res.cookie("refreshToken", refreshRaw, {
        httpOnly: true, //Prevents JS on the client-side from accessing the cookie, protecting it from XSS attacks.
        secure: config.nodeEnv === "production", //Ensures the cookie is only sent over HTTPS in a production environment.
        sameSite: "lax", //Provides some protection against Cross-Site Request Forgery (CSRF) attacks.
        maxAge: config.refreshTokenExpiresDays * 24 * 60 * 60 * 1000, //Sets the cookie's expiration time in milliseconds to match the token's lifespan.
        path: "/api/auth", //Specifies that the cookie should only be sent for requests to your authentication-related API endpoints.
    });

    return res.status(201).json({
        user:{ id: user._id, email: user.email, name: user.name},
        accessToken,
    });
};

export const login = async (req, res) => {
    //For a login, this might just check that the email and password fields are not empty.
    const errors = validationResult(req);
    if(!errors.isEmpty())
        return res.status(400).json({
            errors: errors.array()
        });
    //This extracts the email and password provided by the user from the request's body.
    const {email, password} = req.body;
    const user = await User.findOne({ email });
    if(!user) return res.status(401).json({message: "Invalid credentials"});

    //uses bcrypt.compare to safely compare the plain-text password sent by the user with the hashed password
    const match = await bcrypt.compare(password, user.password);
    if(!match) return res.status(401).json({message: "Invalid credentials"});

    //Once the user's identity is confirmed, this line calls the signAccessToken function to create a new, short-lived access token.
    const accessToken = signAccessToken(user);

    //create refresh token
    const refreshRaw = genRefreshTokenRaw();
    const refreshHash = hashToken(refreshRaw);
    const expiresAt = new Date(Date.now() + config.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

    //A new document is created in the RefreshToken collection, storing the hashed refresh token, the user's ID, and the token's expiration date.
    await RefreshToken.create({
        tokenHash: refreshHash,
        user: user._id,
        expiresAt,
    });

    res.cookie("refreshToken", refreshRaw, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "lax",
        maxAge: config.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
        path: "/api/auth",
    });

    return res.json({
        user: {id: user._id, email: user.email, name: user.name },
        accessToken,
    });
};

export const refresh = async (req, res) => {
    //read raw token from cookie
    const raw = req.cookies?.refreshToken;
    if(!raw) return res.status(401).json({message: "No refresh Token"});

    const hash = hashToken(raw);
    const tokenDoc = await RefreshToken.findOne({tokenHash: hash}).populate("user");
    if(!token) {
        return res.status(401).json({message: "Invalid Refresh Token"});
    }

    if (tokenDoc.revoked || tokenDoc.expiresAt < new Date()) {
    return res.status(401).json({ message: "Refresh token expired or revoked" });
  }

  const newRaw = genRefreshTokenRaw();
  const newHash = hashToken(newRaw);
  const newExpiresAt = new Date(Date.now() + config.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

  tokenDoc.revoked = true;
  tokenDoc.replacedByHash = newHash;
  await tokenDoc.save();

  await RefreshToken.create({
    tokenHash : newHash,
    user: tokenDoc.user._id,
    expiresAt: newExpiresAt,
  });

  const accessToken = signAccessToken(tokenDoc.user);

  refresh.cookie("refreshToken", newRaw, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: config.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });

  return res.json({
    user: { id: tokenDoc.user._id, email: tokenDoc.user.email, name: tokenDoc.user.name },
    accessToken,
  });
};

export const logout = async (req, res) => {
    const raw = req.cookies?.refreshToken;
    if(raw) {
        const hash = hashToken(raw);
        await RefreshToken.findOneAndUpdate({ tokenHash: hash }, {revoked: true}).exec();
    }
    res.clearCookie("refreshToken", {path: "/api/auth"});
    return res.json({message: "Logged out"});
};

export const me = async(req,res) => {
    const user = await User.findById(req.user.sub).select("-password");
    if(!user) return res.status(404).json({message: "User not found"});
    res.json(user);
};