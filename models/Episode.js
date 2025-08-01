import mongoose from "mongoose";
import subtitleSchema from "./Subtitle";

const episodeSchema = new mongoose.Schema({
    animeSlug: String,
    episodeNumber: Number,
    videoId: String,
    status: {
        type: String,
        enum: ["processing", "ready", "error"],
        default: "processing"
    },
    subtitles: [subtitleSchema]
}, {timestamps: true});
export default mongoose.model("Episode", episodeSchema);