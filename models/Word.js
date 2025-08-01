import mongoose from "mongoose";

const wordSchema = new mongoose.Schema({
     word: String,
     redaing: String,
     romaji: String,
     meaning: String,
     jplt: Number,
});

export default wordSchema;