// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve static frontend files
app.use(express.static(path.join(process.cwd(), "Static")));

// ✅ Initialize Supabase client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error("❌ Missing Supabase environment variables!");
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ✅ Multer config for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Login route
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
    console.error("Login Error:", err.message);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// ✅ File Upload + Dynamic Excel Table Insert
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // Step 1: Upload file to Supabase Storage
    const filePath = `uploads/${Date.now()}_${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(filePath, file.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.mimetype,
      });

    if (uploadError) throw uploadError;

    // Step 2: Read Excel data
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (sheetData.length === 0) {
      return res.status(400).json({ error: "Excel file is empty" });
    }

    // Step 3: Create dynamic table (using correct RPC function)
    const tableName = `excel_data_${Date.now()}`;
    const columns = Object.keys(sheetData[0])
      .map((col) => `"${col}" text`)
      .join(",");

    const { error: tableError } = await supabase.rpc("execute_sql", {
      sql: `CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, ${columns});`,
    });

    if (tableError) throw tableError;

    // Step 4: Insert all rows dynamically
    for (const row of sheetData) {
      const keys = Object.keys(row)
        .map((k) => `"${k}"`)
        .join(",");
      const values = Object.values(row)
        .map((v) => `'${v}'`)
        .join(",");

      const { error: insertError } = await supabase.rpc("execute_sql", {
        sql: `INSERT INTO ${tableName} (${keys}) VALUES (${values});`,
      });

      if (insertError) throw insertError;
    }

    // Step 5: Get public URL of uploaded file
    const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(filePath);

    res.json({
      success: true,
      message: "✅ File uploaded and data inserted successfully!",
      url: publicUrlData.publicUrl,
      tableName,
    });
  } catch (error) {
    console.error("Upload failed:", error.message);
    res.status(500).json({ error: "File uploaded, but data insert failed." });
  }
});

// ✅ Logout route
app.get("/logout", (req, res) => {
  res.redirect("/index.html");
});

// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
