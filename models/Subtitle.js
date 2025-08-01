import mongoose from "mongoose";
import wordSchema from "./Word";

const subtitleSchema = new mongoose.Schema({
    line: String,
    start: String,
    end: String,
    words: [wordSchema]
});

export default subtitleSchema;