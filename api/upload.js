import express from 'express';
import multer from 'multer';

const app = express();
const upload = multer({ dest: '/tmp' }); // serverless temporary folder

app.post('*', upload.single('uploaded_file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  res.status(200).json({ success: true, message: 'File uploaded successfully!' });
});

export default app;
