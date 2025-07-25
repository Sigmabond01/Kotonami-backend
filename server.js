import express from "express";
import { exec } from "child_process";
import fs from "fs/promises";
import path, { resolve } from "path";
import { fileURLToPath } from "url";
import ejs from "ejs";

import { initKuroshiro, getWordsData } from "./wordParser.js";
import { parseVTT } from "./vttparser.js";
import { stderr, stdout } from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//Sets the view engine for Express to EJS.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

let kuroshiroInstance;
async function initializeKuroshiro() {
  console.log("Server starting: Initializing Kuroshiro...");
  try {
    kuroshiroInstance = await initKuroshiro();
    console.log("Kuroshiro initialized!");
  } catch (error) {
    console.error("Kuroshiro Initialization failed:", error);
    process.exit(1);
  }
}

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/subtitles/:videoId", async (req, res) => {
  const videoId = req.params.videoId;
  const long = req.query.lang || 'en';

  //Constructs the expected output filename for the VTT file downloaded by yt-dlp
  const outputFile = `${videoId}.${lang}.vtt`;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const command = `yt-dlp --write-auto-sub --skip-download --sub-lang ${lang} --sub-format vtt -o "${videoId}.%(ext)s" "${youtubeUrl}"`;

  let vttContent = '';
  try {
    console.log(`Downloading ${lang} subtitles for ${videoId}...`);
    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if(error) {
          console.error(`yt-dlp exec error for ${videoId} (${lang}):`, error.message);
          console.error(`yt-dlp stderr:`, stderr); 
          if (stderr.includes('No subtitles found') || stderr.includes('No video formats found')) {
              console.warn(`No ${lang} subtitles found for ${videoId}. Proceeding with empty content.`);
              resolve();
          } else {
            // Rejects the promise for other, unexpected yt-dlp errors.
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
      vttContent = await fs.readFile(filePath, 'utf-8');
      console.log(`Successfully read VTT file: ${filePath}`);
    } catch (roadError) {
      console.warn(`Could not read VTT file ${filePath}. It might not exist or be empty. Error: ${readError.message}`);
      vttContent = '';
    } finally {
      await fs.unlink(filePath).catch(err => console.err(`Error deleting ${filePath}:`, err));
    }

    const parsedData = parseVTT(vttContent);
    console.log(`Parsed ${parsedData.length} subtitle lines for ${lang}.`);
    res.json(parsedData);
  } catch (error) {
    console.error(`API: Overall error processing subtitles for ${videoId} (${lang}):`, error.message);
    res.status(500).json({error: 'Failed to process the subtitles', details: error.message});
  }
});

app.post("/parse-japanese-text", async (req, res) => {
  const {sentence} = req.body;
  if(!sentence) {
    return res.status(400).json({
      error: "Missing 'Sentence' in request body"
    });
  }
  if(!kuroshiroInstance) {
    return res.status(503).json({
      error: "Kuroshiro is not initilaized yet"
    });
  }
  console.log(`API: Received sentence for parsing: "${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}"`);

  try {
    const wordsData = await getWordsData(sentence, kuroshiroInstance);
    console.log(`API: Successfully parsed sentence and fetched data.`);
    res.json(wordsData);
  } catch(error) {
    console.error("API: Error parsing Japanese text:", error.message);
    res.status(500).json({ error: "Failed to parse Japanese text or fetch word data.", details: error.message });
  }
});

//starts the Express server.
initializeKuroshiro().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  })
})