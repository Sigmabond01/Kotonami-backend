import axios from "axios";
import { connectToDb } from "./db.js";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function initKuroshiro() {
  const KuroshiroModule = await import("kuroshiro");
  const Kuroshiro = KuroshiroModule.default.default;
  const KuromojiAnalyzerModule = await import("kuroshiro-analyzer-kuromoji");
  const KuromojiAnalyzer = KuromojiAnalyzerModule.default;
  const analyzer = new KuromojiAnalyzer();
  const kuroshiro = new Kuroshiro();
  await kuroshiro.init(analyzer);
  return kuroshiro;
}

export const getWordsData = async (sentence, kuroshiro) => {
  const db = await connectToDb();
  const wordsCollection = db.collection('words');
  const tokens = await kuroshiro._analyzer._analyzer.tokenize(sentence);
  const wordResults = [];

  for (const token of tokens) {
    const word = token.surface_form;
    const reading = await kuroshiro.convert(word, { to: "hiragana" });
    const romaji = await kuroshiro.convert(word, { to: "romaji" });
    let meaning = "";
    let jlpt = "";

    const cachedWord = await wordsCollection.findOne({ word });

    if (cachedWord) {
      ({ meaning, jlpt } = cachedWord);
    } else {
      try {
        await sleep(100);
        const res = await axios.get(
          `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`,
          { headers: { 'User-Agent': 'Kotonami-Backend/1.0 (smdnoor4966@gmail.com)' } }
        );
        const entry = res.data.data[0];
        if (entry) {
          meaning = entry.senses[0]?.english_definitions?.join(", ") || "Not found";
          jlpt = entry.jlpt && entry.jlpt.length > 0 ? entry.jlpt[0] : "";
        } else {
            meaning = "Not found";
            jlpt = "";
        }
        await wordsCollection.insertOne({ word, meaning, jlpt });
      } catch (e) {
        meaning = "Error fetching";
        jlpt = "";
        console.error(`Error fetching data for word "${word}":`, e.message);
        await wordsCollection.insertOne({ word, meaning, jlpt });
      }
    }
    wordResults.push({ word, reading, romaji, meaning, jlpt });
  }
  return wordResults;
};