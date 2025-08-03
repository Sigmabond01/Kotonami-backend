import parser from "subtitles-parser-vtt";

export const parseVTT = (vttContentString) => {
  if (!vttContentString || vttContentString.trim() === '') {
    return [];
  }
  try {
    const data = parser.fromVtt(vttContentString);
    const uniqueSubtitles = [];
    const seen = new Set();
    data.forEach(line => {
      const cleanedText = line.text
        .replace(/\r/g, "")
        .replace(/<[^>]+>/g, '')
        .trim();
      const key = `${line.startTime}-${cleanedText}`;
      if (cleanedText && !seen.has(key)) {
        seen.add(key);
        uniqueSubtitles.push({
          start: line.startTime,
          end: line.endTime,
          text: cleanedText
        });
      }
    });
    return uniqueSubtitles;
  } catch (error) {
    console.error("Error parsing VTT content:", error);
    return [];
  }
};