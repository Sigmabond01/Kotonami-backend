import mongoose from "mongoose";

const RefreshTokenSchema = new mongoose.Schema({
    tokenHash: {type: String, required: true, unique: true},
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
    expiresAt: {type: Date, required: true},
    revoked: {type: Boolean, default: false},
    createdAt: {type: Date, default: Date.now },
    replacedByHash: {type: String, default: null},
});

export default mongoose.model("RefreshToken", RefreshTokenSchema);