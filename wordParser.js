import axios from "axios";
import fs from 'fs/promises';
import path from 'path';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const CACHE_FILE_NAME = 'jisho_word_cache.json';
const cachePath = path.join(process.cwd(), CACHE_FILE_NAME);

let wordCache = {};

async function loadCache() {
  try {
    const data = await fs.readFile(cachePath, 'utf-8');
    wordCache = JSON.parse(data);
    console.log(`Loaded ${Object.keys(wordCache).length} words from cache.`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Jisho word cache file not found. Starting with empty cache.');
      wordCache = {};
    } else {
      console.error('Error loading Jisho word cache:', error.message);
      wordCache = {};
    }
  }
}

async function saveCache() {
  try {
    await fs.writeFile(cachePath, JSON.stringify(wordCache, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving Jisho word cache:', error.message);
  }
}

export async function initKuroshiro() {
  console.log("Attempting to import Kuroshiro...");
  const KuroshiroModule = await import("kuroshiro");
  const Kuroshiro = KuroshiroModule.default.default;
  if (typeof Kuroshiro !== 'function') {
    console.error("Kuroshiro.default.default is not a function! Actual type:", typeof Kuroshiro);
    throw new Error("Kuroshiro not found as a constructor after import.");
  }
  console.log("Kuroshiro class imported successfully.");

  console.log("Attempting to import KuromojiAnalyzer...");
  const KuromojiAnalyzerModule = await import("kuroshiro-analyzer-kuromoji");
  const KuromojiAnalyzer = KuromojiAnalyzerModule.default;
  if (typeof KuromojiAnalyzer !== 'function') {
    console.error("KuromojiAnalyzer.default is not a function! Actual type:", typeof KuromojiAnalyzer);
    throw new Error("KuromojiAnalyzer not found as a constructor after import.");
  }
  console.log("KuromojiAnalyzer class imported successfully.");

  const analyzer = new KuromojiAnalyzer();
  console.log("KuromojiAnalyzer instance created.");

  const kuroshiro = new Kuroshiro();
  console.log("Kuroshiro instance created.");

  await kuroshiro.init(analyzer);
  console.log("Kuroshiro initialized successfully with KuromojiAnalyzer.");

  await loadCache();

  return kuroshiro;
}

export const getWordsData = async (sentence, kuroshiro) => {
  const tokens = await kuroshiro._analyzer._analyzer.tokenize(sentence);

  const wordResults = [];
  let cacheUpdated = false;

  for (const token of tokens) {
    const word = token.surface_form;
    const reading = await kuroshiro.convert(word, { to: "hiragana" });
    const romaji = await kuroshiro.convert(word, { to: "romaji" });

    let meaning = "";
    let jlpt = "";

    if (wordCache[word]) {
      ({ meaning, jlpt } = wordCache[word]);
    } else {
      try {
        await sleep(100);

        const res = await axios.get(
          `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`,
          {
            headers: {
              'User-Agent': 'Kotonami-Backend/1.0 (contact@example.com)'
            }
          }
        );

        const entry = res.data.data[0];
        if (entry) {
          meaning = entry.senses[0]?.english_definitions?.join(", ") || "";
          console.log(`[Jisho API] Word: "${word}", Raw JLPT from API:`, entry.jlpt);
          jlpt = entry.jlpt && entry.jlpt.length > 0 ? entry.jlpt[0] : ""; // More robust check
        }

        wordCache[word] = { meaning, jlpt };
        cacheUpdated = true;

      } catch (e) {
        meaning = "Not found";
        jlpt = "";
        console.error(`Error fetching data for word "${word}":`, e.message);
        wordCache[word] = { meaning: "Not found", jlpt: "" };
        cacheUpdated = true;
      }
    }

    wordResults.push({ word, reading, romaji, meaning, jlpt });
  }

  if (cacheUpdated) {
    await saveCache();
  }

  return wordResults;
};
