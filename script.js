import fs from 'fs';
import { parse } from 'subtitle';

const vttData = fs.readFileSync('beast.vtt', 'utf-8');
const parsed = parse(vttData);

const jsonOutput = parsed
  .filter(line => line.type === 'cue')
  .map(({ data }) => ({
    start: data.start,
    end: data.end,
    text: data.text
  }));

fs.writeFileSync('output.json', JSON.stringify(jsonOutput, null, 2));
console.log('✅ Done. output.json created.');
