import mongoose from "mongoose";

const animeSchema = new mongoose.Schema({
    title: String,
    slug: String,
    episodes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Episode" }]
});

export default mongoose.model("Anime", animeSchema);