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

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    const VTT_CACHE_DIR = path.join(__dirname, 'vtt_cache');
    fs.mkdir(VTT_CACHE_DIR, { recursive: true }).catch(console.error);

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

      const cachedFileName = `${videoId}.${lang}.vtt`;
      const cachedFilePath = path.join(VTT_CACHE_DIR, cachedFileName);
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

      let vttContent = '';

      try {
        try {
          vttContent = await fs.readFile(cachedFilePath, 'utf8');
          console.log(`[VTT Cache Hit] Loaded ${lang} subtitles for ${videoId} from cache.`);
        } catch (cacheReadError) {
          console.log(`[VTT Cache Miss] Fetching ${lang} subtitles for ${videoId} from YouTube...`);

          const tempOutputFileNameBase = `${videoId}_${lang}_temp`;
          const tempOutputFilePathBase = path.join(VTT_CACHE_DIR, tempOutputFileNameBase);
          const command = `yt-dlp --write-auto-sub --skip-download --sub-lang ${lang} --sub-format vtt --no-warnings -o "${tempOutputFilePathBase}" "${youtubeUrl}"`;

          try {
            const { stdout, stderr, noSubtitles } = await executeYtDlpCommand(command, videoId, lang);
            console.log(`yt-dlp stdout for ${videoId} (${lang}):`, stdout);
            if (noSubtitles) {
                vttContent = '';
                await fs.writeFile(cachedFilePath, '', 'utf8');
                console.warn(`No ${lang} subtitles found for ${videoId}. Cached empty content.`);
            } else {
                const actualYtdlpFileName = `${tempOutputFileNameBase}.${lang}.vtt`;
                const actualYtdlpFilePath = path.join(VTT_CACHE_DIR, actualYtdlpFileName);

                try {
                    await fs.access(actualYtdlpFilePath);
                    await fs.rename(actualYtdlpFilePath, cachedFilePath);
                    console.log(`Renamed yt-dlp created file ${actualYtdlpFileName} to ${cachedFileName}.`);
                } catch (renameError) {
                    console.error(`Error renaming yt-dlp created file ${actualYtdlpFileName} to ${cachedFileName}:`, renameError.message);
                    await fs.unlink(actualYtdlpFilePath).catch(() => {});
                    throw new Error(`Failed to finalize VTT file after download: ${renameError.message}`);
                }
                vttContent = await fs.readFile(cachedFilePath, 'utf8');
                console.log(`Successfully read downloaded VTT file: ${cachedFilePath}`);
            }
          } catch (ytDlpError) {
            throw new Error(`Failed to download subtitles: ${ytDlpError.message}`);
          }
        }

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
        res.json(wordsData);
      } catch (error) {
        console.error("API: Error parsing Japanese text:", error.message);
        res.status(500).json({ error: "Failed to parse Japanese text or fetch word data.", details: error.message });
      }
    });

    initializeKuroshiro().then(() => {
      app.listen(PORT, () => {
        console.log(`🔥 Server running on http://localhost:${PORT}`);
      });
    });
    