import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    email: {type: String, required: true, unique: true, lowercase:true, trim: true },
    password: {type:String, required: true},
    name: {type: String, default: ""},
    createdAt: {type: Date, default: Date.now },
});

export default mongoose.model("User", UserSchema);