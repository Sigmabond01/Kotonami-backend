import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectToDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedDatabase = async () => {
  try {
    const dataPath = path.join(__dirname, 'anime_data.json');
    const animeDataString = await fs.readFile(dataPath, 'utf8');
    const anime = JSON.parse(animeDataString);

    const db = await connectToDb();
    const collection = db.collection('animes');

    await collection.deleteMany({});
    console.log('Cleared existing data from "animes" collection.');
    await collection.insertMany(anime);
    console.log(`Successfully inserted ${anime.length} anime documents!`);
    
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed database:', error);
    process.exit(1);
  }
};

seedDatabase();