

import multer from 'multer';

export const config = { api: { bodyParser: false } };

const upload = multer({ storage: multer.memoryStorage() });

export default function handler(req, res) {
  if(req.method === 'POST') {
    upload.single('uploaded_file')(req, res, (err) => {
      if(err) return res.status(500).send('Upload error');
      // File is in memory
      res.status(200).json({ success: true, filename: req.file.originalname });
    });
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
