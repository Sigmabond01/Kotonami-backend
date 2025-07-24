import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

app.get('/subtitles/:videoId', (req, res) => {
  const videoId = req.params.videoId;
  const outputFile = `${videoId}.en.vtt`;

  // yt-dlp command
  const command = `yt-dlp --write-auto-sub --skip-download --sub-lang en --sub-format vtt -o "${videoId}.%(ext)s" https://www.youtube.com/watch?v=${videoId}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("Exec error:", error);
      return res.status(500).json({ error: 'yt-dlp failed' });
    }

    const filePath = path.resolve(`./${outputFile}`);

    // Read VTT file
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error("Read error:", err);
        return res.status(500).json({ error: 'Subtitle read failed' });
      }

      // Delete file after read
      fs.unlink(filePath, () => {});
      
      // Optionally parse the .vtt or just send raw
      res.send(data);
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
