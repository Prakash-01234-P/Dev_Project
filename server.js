import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "Static")));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Multer setup for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Serve login page
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "Static", "index.html"));
});

// Login API
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

    res.json({ success: true, redirect: "/home.html" });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// File Upload API
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const filePath = `uploads/${Date.now()}_${file.originalname}`;

    // Upload to Supabase storage
    const { data: uploadedFile, error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) {
      console.error("❌ Upload Error:", uploadError.message);
      return res.status(500).json({ success: false, error: uploadError.message });
    }

    // Get public URL
    const { data: publicData } = supabase.storage.from("uploads").getPublicUrl(filePath);
    const fileUrl = publicData.publicUrl;

    // Try inserting into DB (optional)
    const { error: dbError } = await supabase
      .from("uploaded_files")
      .insert([{ file_name: file.originalname, file_url: fileUrl, file_path: filePath }]);

    if (dbError) {
      console.warn("⚠️ Database insert failed:", dbError.message);
      // Still send success to client since upload worked
      return res.status(200).json({
        success: true,
        message: "File uploaded, but database insert failed.",
        file_url: fileUrl,
      });
    }

    // Success response
    res.json({
      success: true,
      message: "File uploaded successfully!",
      file_url: fileUrl,
    });
  } catch (error) {
    console.error("❌ Upload Failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// ✅ Logout route - redirect to login page
app.get("/logout", (req, res) => {
  res.redirect("/index.html");
});


app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
