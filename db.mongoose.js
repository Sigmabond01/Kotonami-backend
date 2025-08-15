import mongoose from "mongoose";

export async function connectMongoose() {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined in your .env");
  }

  try {
    await mongoose.connect(MONGO_URI, {
      dbName: "Kotonami",
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log("✅ Connected to MongoDB via Mongoose (Auth DB)!");
  } catch (err) {
    console.error("❌ Could not connect to MongoDB via Mongoose", err);
    process.exit(1);
  }
}
