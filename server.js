import express from "express";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "Static")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Static", "index.html"));
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  console.log("Login attempt:", username, password);

  if (username === "admin" && password === "admin123") {
    res.json({ success: true, redirect: "/home.html" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.post("/api/upload", upload.single("uploaded_file"), (req, res) => {
  console.log("Uploaded file info:", req.file);

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  res.json({ success: true, message: "File uploaded successfully!" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
