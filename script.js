import path from "path";
import {
  fileURLToPath
} from "url";
import {
  parseVTT
} from "./vttparser.js";
import {
  initKuroshiro,
  getWordsData
} from "./wordParser.js";
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vttPath = path.join(__dirname, "subtitles", "beast.vtt");

const run = async () => {
  console.log('Loading subtitles...');
  const subs = parseVTT(await fs.readFile(vttPath, 'utf-8'));
  console.log(`✅ Loaded ${subs.length} subtitle lines from "${vttPath}"`);

  console.log('Initializing Kuroshiro for analysis...');
  const kuroshiro = await initKuroshiro();
  console.log('Kuroshiro initialized.');

  const allProcessedData = [];

  console.log('\n--- Starting word data extraction for all lines ---');

  for (let i = 0; i < subs.length; i++) {
    const subtitleLine = subs[i];
    const lineText = subtitleLine.text;

    console.log(`\n🧠 Processing line ${i + 1}/${subs.length} (Time: ${subtitleLine.start}-${subtitleLine.end}): "${lineText.substring(0, 70)}${lineText.length > 70 ? '...' : ''}"`);

    try {
      const wordsData = await getWordsData(lineText, kuroshiro);
      allProcessedData.push({
        lineNumber: i + 1,
        startTime: subtitleLine.start,
        endTime: subtitleLine.end,
        originalText: lineText,
        words: wordsData
      });
      console.log(`✅ Finished processing line ${i + 1}.`);
    } catch (error) {
      console.error(`❌ Error processing line ${i + 1} (${subtitleLine.start}-${subtitleLine.end}): "${lineText.substring(0, 70)}${lineText.length > 70 ? '...' : ''}"`, error.message);
      allProcessedData.push({
        lineNumber: i + 1,
        startTime: subtitleLine.start,
        endTime: subtitleLine.end,
        originalText: lineText,
        error: error.message
      });
    }
  }

  console.log('\n--- All lines processed ---');

  const outputFileName = 'processed_subtitle_data.json';
  const outputPath = path.join(__dirname, outputFileName);
  try {
    await fs.writeFile(outputPath, JSON.stringify(allProcessedData, null, 2), 'utf-8');
    console.log(`✨ All processed data saved to ${outputPath}`);
  } catch (fileWriteError) {
    console.error(`Error saving processed data to ${outputPath}:`, fileWriteError.message);
  }
};

run().catch(console.error);