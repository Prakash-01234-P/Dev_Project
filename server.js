// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ✅ Serve static frontend files (index.html, home.html, etc.)
app.use(express.static(path.join(process.cwd(), "Static")));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ✅ Configure file upload with multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ✅ Routes
// Serve login page
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "Static", "index.html"));
});

// ✅ Login API
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Simple check from Supabase 'logins' table
    const { data, error } = await supabase
      .from("logins")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.json({ success: true, redirect: "/home.html" });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// ✅ File upload API
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload to Supabase storage
    const filePath = `uploads/${Date.now()}_${file.originalname}`;
    const { data, error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(filePath, file.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.mimetype,
      });

    if (uploadError) {
      console.error("Upload Error:", uploadError.message);
      return res.status(500).json({ error: uploadError.message });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("uploads")
      .getPublicUrl(filePath);

    // Insert record into Supabase table
    const { error: dbError } = await supabase.from("uploaded_files").insert([
      {
        file_name: file.originalname,
        file_url: publicUrlData.publicUrl,
        file_path: filePath,
      },
    ]);

    if (dbError) {
      console.error("DB Error:", dbError.message);
      return res.status(500).json({ error: dbError.message });
    }

    res.json({
      success: true,
      message: "File uploaded successfully",
      url: publicUrlData.publicUrl,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "File upload failed" });
  }
});

// ✅ Logout route (redirect to login page)
app.get("/logout", (req, res) => {
  res.redirect("/index.html");
});

// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
