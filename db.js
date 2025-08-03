import { MongoClient } from "mongodb";

const DB_NAME = "Kotonami";

let client;
let db;

export async function connectToDb() {
  if (db) {
    return db;
  }

  const MONGO_URI = process.env.MONGO_URI;
  
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined in your environment variables.");
  }

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();

    db = client.db(DB_NAME);
    
    console.log("Connected successfully to MongoDB!");
    return db;
  } catch (error) {
    console.error("Could not connect to MongoDB", error);
    process.exit(1);
  }
}