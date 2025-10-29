import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("static"));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ✅ LOGIN API
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data, error } = await supabase
      .from("logins")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.json({ success: true, message: "Login successful" });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ FILE UPLOAD API
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const filePath = `uploads/${Date.now()}_${file.originalname}`;

    const { data, error } = await supabase.storage
      .from("uploads")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error("Upload Error:", error);
      return res.status(500).json({ success: false, message: "Upload failed" });
    }

    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(filePath);

    await supabase.from("uploaded_files").insert([
      {
        file_name: file.originalname,
        file_url: urlData.publicUrl,
        file_path: filePath,
      },
    ]);

    res.json({ success: true, fileUrl: urlData.publicUrl });
  } catch (err) {
    console.error("File Upload Error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ START SERVER
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
