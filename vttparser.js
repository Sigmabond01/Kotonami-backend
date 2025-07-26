import parser from "subtitles-parser-vtt";

export const parseVTT = (vttContentString) => {
  if (!vttContentString || vttContentString.trim() === '') {
    console.warn("parseVTT received empty or null content string.");
    return [];
  }
  try {
    const data = parser.fromVtt(vttContentString);
    return data.map(line => ({
      start: line.startTime,
      end: line.endTime,
      text: line.text.replace(/\r/g, "")
    }));
  } catch (error) {
    console.error("Error parsing VTT content:", error);
    return [];
  }
};