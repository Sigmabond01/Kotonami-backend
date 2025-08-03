import dotenv from 'dotenv';
dotenv.config();
console.log('Loaded MONGO_URI:', process.env.MONGO_URI);

import express from "express";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import ejs from "ejs";

import { initKuroshiro, getWordsData } from "./wordParser.js";
import { parseVTT } from "./vttparser.js";
import { connectToDb } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

let kuroshiroInstance;
let db;

async function initialize() {
  console.log("Server starting: Initializing services...");
  try {
    kuroshiroInstance = await initKuroshiro();
    console.log("Kuroshiro initialized successfully.");
    db = await connectToDb();
  } catch (error) {
    console.error("Failed to initialize services:", error);
    process.exit(1);
  }
}

app.get("/", (req, res) => {
  res.render("index");
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TEMP_VTT_DIR = path.join(__dirname, 'vtt_temp');
fs.mkdir(TEMP_VTT_DIR, { recursive: true }).catch(console.error);

async function executeYtDlpCommand(command, videoId, lang, retries = 3, delayMs = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      if (i > 0) {
        console.warn(`Retrying yt-dlp for ${videoId} (${lang}), attempt ${i + 1}/${retries}...`);
        await sleep(delayMs * (i + 1));
      } else {
        await sleep(delayMs);
      }

      return await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            if (stderr.includes('HTTP Error 429: Too Many Requests') && i < retries - 1) {
              console.warn(`yt-dlp hit 429 for ${videoId} (${lang}). Retrying...`);
              return reject(new Error('RATE_LIMITED'));
            }
            if (stderr.includes('No subtitles found') || stderr.includes('No video formats found')) {
              console.warn(`No ${lang} subtitles found for ${videoId}.`);
              return resolve({ stdout, stderr, noSubtitles: true });
            }
            return reject(new Error(`Command failed: ${error.message}\nStderr: ${stderr}`));
          }
          resolve({ stdout, stderr, noSubtitles: false });
        });
      });
    } catch (error) {
      if (error.message === 'RATE_LIMITED') {
        continue;
      }
      throw error;
    }
  }
  throw new Error(`yt-dlp failed after ${retries} attempts for ${videoId} (${lang}).`);
}

app.get("/subtitles/:videoId", async (req, res) => {
  const videoId = req.params.videoId;
  const lang = req.query.lang || 'en';
  let vttContent = '';

  const subtitlesCollection = db.collection('subtitles');

  try {
    const cachedSub = await subtitlesCollection.findOne({ videoId, lang });
    
    if (cachedSub) {
      console.log(`[Mongo Cache Hit] Loaded ${lang} subtitles for ${videoId} from DB.`);
      vttContent = cachedSub.content;
    } else {
      console.log(`[Mongo Cache Miss] Fetching ${lang} subtitles for ${videoId} from YouTube...`);
      const tempOutputFileNameBase = `${videoId}_${lang}_${Date.now()}`;
      const tempOutputFilePathBase = path.join(TEMP_VTT_DIR, tempOutputFileNameBase);
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const command = `yt-dlp --write-auto-sub --skip-download --sub-lang ${lang} --sub-format vtt --no-warnings -o "${tempOutputFilePathBase}" "${youtubeUrl}"`;

      const { noSubtitles } = await executeYtDlpCommand(command, videoId, lang);

      if (noSubtitles) {
        vttContent = '';
        await subtitlesCollection.insertOne({ videoId, lang, content: '', createdAt: new Date() });
      } else {
        const actualYtdlpFilePath = `${tempOutputFilePathBase}.${lang}.vtt`;
        try {
            vttContent = await fs.readFile(actualYtdlpFilePath, 'utf8');
            await subtitlesCollection.insertOne({ videoId, lang, content: vttContent, createdAt: new Date() });
            console.log(`Saved ${lang} subtitles for ${videoId} to DB.`);
        } finally {
            await fs.unlink(actualYtdlpFilePath).catch(err => console.error(`Failed to delete temp file: ${actualYtdlpFilePath}`, err));
        }
      }
    }

    const parsedData = parseVTT(vttContent);
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
    return res.status(503).json({ error: "Server is not ready. Please try again shortly." });
  }

  try {
    const wordsData = await getWordsData(sentence, kuroshiroInstance);
    res.json(wordsData);
  } catch (error) {
    console.error("API: Error parsing Japanese text:", error.message);
    res.status(500).json({ error: "Failed to parse Japanese text.", details: error.message });
  }
});

initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`🔥 Server running on http://localhost:${PORT}`);
  });
});