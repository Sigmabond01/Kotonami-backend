import { z } from "zod";

export const AnimeSchema = z.object({
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    image: z.string().url(),
    episodes: z.array(
        z.object({
            number: z.number(),
            embedUrl: z.string().url(),
        })
    ),
});