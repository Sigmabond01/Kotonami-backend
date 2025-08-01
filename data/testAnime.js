import { AnimeSchema } from "../schemas/animeSchema.js";

const oneAnime = {
  slug: "mob-psycho-100",
  title: "Mob Psycho 100",
  description: "A middle schooler with psychic powers...",
  thumbnail: "https://i.imgur.com/example.jpg",
  episodes: [
    {
      number: 1,
      embedUrl: "https://www.youtube.com/embed/ep1-url",
    },
    {
      number: 2,
      embedUrl: "https://www.youtube.com/embed/ep2-url",
    },
  ],
};

try {
  AnimeSchema.parse(oneAnime);
  console.log("Anime is valid!");
} catch (err) {
  console.error("Invalid anime:", err.errors);
}
