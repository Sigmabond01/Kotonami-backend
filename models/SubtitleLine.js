import mongoose from "mongoose";

const WordSchema = new mongoose.Schema({
    word: String,
    reading: String,
    romaji: String,
    meaning: String,
    jplt: String
}, { _id: false });

const SubtitleLineSchema = new mongoose.Schema({
    episodeId: {type: mongoose.Schema.Types.ObjectId, ref: 'Episode', required: false},
    lineNumber: Number,
    startTime: String,
    endTime: String,
    originalText: String,
    words: [WordSchema],
    error: String
});

export default mongoose.model('SubtitleLine', SubtitleLineSchema);