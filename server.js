const express = require('express');
const path = require('path');
const multer = require('multer'); // For file upload
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Static')));

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' }); // files will be saved in 'uploads' folder

// Serve login page
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Static', 'login.html')));

// Handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Hardcoded login for demo
  if (username === 'admin' && password === 'admin123') {
    res.sendFile(path.join(__dirname, 'Static', 'home.html'));
  } else {
    res.send('<h2>Invalid credentials!</h2><a href="/">Go back to Login</a>');
  }
});

// Handle file upload
app.post('/upload', upload.single('uploaded_file'), (req, res) => {
  console.log('Uploaded file info:', req.file);
  // Serve styled success page
  res.sendFile(path.join(__dirname, 'Static', 'success.html'));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:3000`));
