const express = require('express');
const path = require('path');
const multer = require('multer');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Static')));

// Serve login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Static', 'index.html'));
});

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username, password);

  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, redirect: '/home.html' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// File upload API
app.post('/api/upload', upload.single('uploaded_file'), (req, res) => {
  console.log('Uploaded file info:', req.file);

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  res.json({ success: true, message: 'File uploaded successfully!' });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:3000`));
