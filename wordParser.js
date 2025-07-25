import axios from "axios";
import fs from 'fs/promises';
import path from 'path';  

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const CACHE_FILE_NAME = 'jisho_word_cache.json';
const cachePath = path.join(process.cwd(), CACHE_FILE_NAME);

let wordCache = {};

//load the word cache from the local file system.
async function loadCache() {
  try {
    const data = await fs.readFile(cachePath, 'utf-8');
    wordCache = JSON.parse(data);
    console.log(`Loaded ${Object.keys(wordCache).length} words from cache`);
  } catch (error) {
    if(error.code === 'ENOENT' ) {
      console.log('Jisho file not found');
      wordCache = {};
    } else {
      console.log('Error loading Jisho: ', error.message);
      wordCache = {};
    }
  }
}

//function to save the current in-memory word cache to the local file system
async function saveCache() {
  try {
    await fs.writeFile(cachePath, JSON.stringify(wordCache, null, 2), 'utf-8');
  } catch(error) {
    console.log('Error saving Jisho: ', error.message);
  }
  
}

//function to initialize the Kuroshiro library and its analyzer.
export async function initKuroshiro() {
  console.log("Importing kuroshiro");
  const KuroshiroModule = await import("kuroshiro");
  const Kuroshiro = KuroshiroModule.default.default;
  if(typeof Kuroshiro !== 'function') {
    console.error("Kuroshiro is not a function", typeof Kuroshiro);
    throw new Error("Kuroshiro not found!");
  }
  console.log("Kuroshiro imported successfully");
  console.log("Attempting to import Analyzer");

  const KuromojiAnalyzerModule = await import("kuroshiro-analyzer-kuromoji");
  const KuromojiAnalyzer = KuromojiAnalyzerModule.default;
  if(typeof KuromojiAnalyzer !== 'function') {
    console.error("Kuromoji is not a function", typeof KuromojiAnalyzer);
    throw new Error("Kuromoji not found");
  }
  console.log("KuromojiAnalyzer class imported successfully.");

  //create new instance
  const analyzer = new KuromojiAnalyzer();
  console.log("Kuromoji instance created !");
  const kuroshiro = new Kuroshiro();
  console.log("Kuroshiro instance created!");

  await kuroshiro.init(analyzer);
  console.log("Kuroshiro initialized successfully with KuromojiAnalyzer."); 

  //ensure cache is ready
  await loadCache();
  return kuroshiro;
}

//function to get detailed word data
export const getWordsData = async (sentence, kuroshiro) => {
  const tokens = await kuroshiro._analyzer._analyzer.tokenize(sentence);

  const wordResults = [];
  let cacheUpdated = false;

  for(const token of tokens) {
    const word = token.surface_form;
    //converting word
    const reading = await kuroshiro.convert(word, { to: "hiragana"});
    const romaji = await kuroshiro.convert(word, { to: "romaji"});

    // Initializes variables for meaning and JLPT level.
    let meaning = "";
    let jplt = "";

    //Caching
    if(wordCache[word]) {
      ({meaning,jplt} = wordCache[word]);
    } else {
      try {
        await sleep(50);
        const res = await axios.get(
          `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`,
          {
            headers: {
              'User-Agent': 'Kotonami-Backend/1.0 (smdnoor4966@gmail.com)'
            }
          }
        );
        const entry = res.data.data[0];
        if(entry) {
          meaning = entry.senses[0]?.english_definitions?.join(", ") || "";
          jplt = entry.jplt[0] || "";
        }
        wordCache[word] = {meaning,jplt};
        cacheUpdated = true;
      } catch (e) {
        meaning = "Not found";
        jplt = "";
        console.error(`Error fetching data for word "${word}":`, e.message);
        wordCache[word] = {meaning: "Not found", jplt: ""};
        cacheUpdated = true;
      }
    }
    wordResults.push({word,reading,romaji,meaning,jplt});
  }
  if(cacheUpdated) {
    await saveCache();
  }
  return wordResults;
}