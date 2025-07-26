import express from "express";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { initKuroshiro, getWordsData } from "./wordParser.js";
import { parseVTT } from "./vttparser.js";
import ejs from "ejs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

let kuroshiroInstance;

async function initializeKuroshiro() {
  console.log("Server starting: Initializing Kuroshiro...");
  try {
    kuroshiroInstance = await initKuroshiro();
    console.log("Kuroshiro initialized successfully for API use.");
  } catch (error) {
    console.error("Failed to initialize Kuroshiro:", error);
    process.exit(1);
  }
}
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/subtitles/:videoId", async (req, res) => {
  const videoId = req.params.videoId;
  const lang = req.query.lang || 'en';

  const outputFile = `${videoId}.${lang}.vtt`;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const command = `yt-dlp --write-auto-sub --skip-download --sub-lang ${lang} --sub-format vtt -o "${videoId}.%(ext)s" "${youtubeUrl}"`;

  let vttContent = '';
  try {
    console.log(`Downloading ${lang} subtitles for ${videoId}...`);
    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`yt-dlp exec error for ${videoId} (${lang}):`, error.message);
          console.error(`yt-dlp stderr:`, stderr);
          if (stderr.includes('No subtitles found') || stderr.includes('No video formats found')) {
              console.warn(`No ${lang} subtitles found for ${videoId}. Proceeding with empty content.`);
              resolve();
          } else {
            return reject(new Error(`Failed to download subtitles: ${error.message}`));
          }
        } else {
          console.log(`yt-dlp stdout for ${videoId} (${lang}):`, stdout);
          resolve();
        }
      });
    });

    const filePath = path.resolve(`./${outputFile}`);

    try {
        //Reads the content of the downloaded VTT file asynchronously as a UTF-8 string.
        vttContent = await fs.readFile(filePath, 'utf8');
        console.log(`Successfully read VTT file: ${filePath}`);
    } catch (readError) {
        console.warn(`Could not read VTT file ${filePath}. It might not exist or be empty. Error: ${readError.message}`);
        vttContent = '';
    } finally {
        await fs.unlink(filePath).catch(err => console.error(`Error deleting ${filePath}:`, err));
    }

    //Parses the VTT content string into a structured JSON array of subtitle objects.
    const parsedData = parseVTT(vttContent);
    console.log(`Parsed ${parsedData.length} subtitle lines for ${lang}.`);
    res.json(parsedData);

  } catch (error) {
    console.error(`API: Overall error processing subtitles for ${videoId} (${lang}):`, error.message);
    res.status(500).json({ error: 'Failed to process subtitles.', details: error.message });
  }
});

app.post("/parse-japanese-text", async (req, res) => {
  const { sentence } = req.body;

  if (!sentence) {
    return res.status(400).json({ error: "Missing 'sentence' in request body." });
  }

  if (!kuroshiroInstance) {
    return res.status(503).json({ error: "Kuroshiro is not initialized yet. Please try again shortly." });
  }

  console.log(`API: Received sentence for parsing: "${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}"`);

  try {
    const wordsData = await getWordsData(sentence, kuroshiroInstance);
    console.log(`API: Successfully parsed sentence and fetched data.`);
    // Sends the array of word data back to the frontend as a JSON response.
    res.json(wordsData);
  } catch (error) {
    console.error("API: Error parsing Japanese text:", error.message);
    res.status(500).json({ error: "Failed to parse Japanese text or fetch word data.", details: error.message });
  }
});

// Starts the Express server.
initializeKuroshiro().then(() => {
  app.listen(PORT, () => {
    console.log(`🔥 Server running on http://localhost:${PORT}`);
  });
});
