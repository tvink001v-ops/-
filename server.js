const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Создаем папки
const uploadsDir = path.join(__dirname, 'uploads');
const thumbnailsDir = path.join(__dirname, 'thumbnails');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir);

// База данных
const DB_PATH = path.join(__dirname, 'videos.json');
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
}

// Хранилище
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'video') cb(null, uploadsDir);
    else if (file.fieldname === 'thumbnail') cb(null, thumbnailsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB для мобильных видео
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      const videoTypes = /mp4|webm|ogg|mov|3gp|mkv/;
      const extname = videoTypes.test(path.extname(file.originalname).toLowerCase());
      if (extname && file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Только видео файлы (mp4, webm, ogg, mov, 3gp, mkv)'));
      }
    } else if (file.fieldname === 'thumbnail') {
      const imageTypes = /jpeg|jpg|png|gif|webp/;
      const extname = imageTypes.test(path.extname(file.originalname).toLowerCase());
      if (extname && file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Только изображения (jpg, png, gif, webp)'));
      }
    }
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));
app.use('/thumbnails', express.static(thumbnailsDir));

// API endpoints
app.get('/api/videos', (req, res) => {
  try {
    const videos = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка чтения базы данных' });
  }
});

app.post('/api/upload', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), (req, res) => {
  try {
    if (!req.files || !req.files['video']) {
      return res.status(400).json({ error: 'Видео файл обязателен' });
    }

    const videoFile = req.files['video'][0];
    const thumbnailFile = req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

    const newVideo = {
      id: Date.now().toString(),
      title: req.body.title || 'Без названия',
      description: req.body.description || '',
      author: req.body.author || 'Аноним',
      videoUrl: `/uploads/${videoFile.filename}`,
      thumbnailUrl: thumbnailFile ? `/thumbnails/${thumbnailFile.filename}` : '/default-thumb.jpg',
      views: 0,
      likes: 0,
      uploadDate: new Date().toISOString(),
      duration: req.body.duration || '0:00'
    };

    const videos = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    videos.unshift(newVideo);
    fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));

    res.status(201).json(newVideo);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки: ' + err.message });
  }
});

app.get('/api/videos/:id', (req, res) => {
  try {
    const videos = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const video = videos.find(v => v.id === req.params.id);
    if (!video) return res.status(404).json({ error: 'Видео не найдено' });
    
    video.views = (video.views || 0) + 1;
    const index = videos.findIndex(v => v.id === req.params.id);
    videos[index] = video;
    fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));
    
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения видео' });
  }
});

app.post('/api/videos/:id/like', (req, res) => {
  try {
    const videos = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const video = videos.find(v => v.id === req.params.id);
    if (!video) return res.status(404).json({ error: 'Видео не найдено' });
    
    if (req.body.type === 'like') video.likes = (video.likes || 0) + 1;
    else if (req.body.type === 'dislike') video.dislikes = (video.dislikes || 0) + 1;
    
    const index = videos.findIndex(v => v.id === req.params.id);
    videos[index] = video;
    fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));
    
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обработки' });
  }
});

app.listen(PORT, () => {
  console.log(`🌟 Frutiger Aero YouTube Mobile running on http://localhost:${PORT}`);
});
