import { text } from "express";
import parser from "subtitles-parser-vtt";

export const parseVTT = (vttContentString) => {
  if(!vttContentString || vttContentString.trim() === '') {
    console.log("Recieved empty or null string");
    return [];
  }
  try {
    //converts the raw VTT text into an array of subtitle cue objects
    const data = parser.fromVtt(vttContentString);
    return data.map(line => ({
      start: line.startTime,
      end: line.endTime,
      text: line.text.replace(/\r/g, "")
    }));
  } catch (error) {
    console.error("Error parsing content: ", error);
    return [];
  }
}