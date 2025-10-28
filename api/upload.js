import express from "express";
import multer from "multer";

// Create Express app
const app = express();
const upload = multer({ dest: "/tmp" }); // Serverless temp dir

app.post("/", upload.single("uploaded_file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  res.status(200).json({ success: true, message: "File uploaded successfully!" });
});

// Export for Vercel
export default (req, res) => {
  app(req, res);
};
