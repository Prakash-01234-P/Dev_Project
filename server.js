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

// ✅ Initialize Supabase client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error("❌ Missing Supabase environment variables!");
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ✅ Multer config for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ----------------------------
   Helpers
----------------------------- */

// escape single quotes for raw SQL string literals
const sqlQuote = (v) => String(v ?? "").replace(/'/g, "''");

// Ensure uploads_log table exists (id, filename, table_name, rows_count, uploaded_at)
async function ensureUploadsLog() {
  const { error } = await supabase.rpc("execute_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS uploads_log (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        table_name TEXT NOT NULL,
        rows_count INTEGER DEFAULT 0,
        uploaded_at TIMESTAMPTZ DEFAULT now()
      );
    `,
  });
  if (error) console.error("⚠️ ensureUploadsLog failed:", error.message);
}
// Run once on boot (best-effort)
ensureUploadsLog();

/* ----------------------------
   Health
----------------------------- */
app.get("/api/ping", (_req, res) => res.json({ ok: true }));

/* ----------------------------
   Auth: Login
----------------------------- */
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

/* ----------------------------
   Upload + Excel → dynamic table
----------------------------- */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: "No file uploaded" });

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
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]); // [{col:value,...}]
    if (sheetData.length === 0) {
      return res.status(400).json({ success: false, error: "Excel file is empty" });
    }

    // Step 3: Create dynamic table with text columns
    const tableName = `excel_data_${Date.now()}`;
    const firstRow = sheetData[0];
    const safeCols = Object.keys(firstRow).map((c) => c.replace(/"/g, '""')); // escape double quotes in identifiers
    const columnDefs = safeCols.map((col) => `"${col}" TEXT`).join(", ");

    const { error: tableError } = await supabase.rpc("execute_sql", {
      sql: `CREATE TABLE ${tableName} (id BIGSERIAL PRIMARY KEY, ${columnDefs});`,
    });
    if (tableError) throw tableError;

    // Step 4: Insert all rows (raw SQL, values escaped)
    for (const row of sheetData) {
      const keys = Object.keys(row).map((k) => `"${k.replace(/"/g, '""')}"`).join(", ");
      const vals = Object.values(row).map((v) => `'${sqlQuote(v)}'`).join(", ");
      const { error: insertError } = await supabase.rpc("execute_sql", {
        sql: `INSERT INTO ${tableName} (${keys}) VALUES (${vals});`,
      });
      if (insertError) throw insertError;
    }

    // Step 5: Public URL of uploaded file
    const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(filePath);

    // Step 6: Log the upload
    const rowsCount = sheetData.length;
    const filename = file.originalname;
    const { error: logError } = await supabase.rpc("execute_sql", {
      sql: `
        INSERT INTO uploads_log (filename, table_name, rows_count)
        VALUES ('${sqlQuote(filename)}', '${sqlQuote(tableName)}', ${rowsCount});
      `,
    });
    if (logError) console.error("⚠️ log insert failed:", logError.message);

    // Step 7: Build preview (first 20 rows)
    const preview = sheetData.slice(0, 20);

    res.json({
      success: true,
      message: "File uploaded and data inserted successfully!",
      file_url: publicUrlData?.publicUrl || null,
      tableName,
      rowsCount,
      preview, // [{...}, ...]
    });
  } catch (error) {
    console.error("Upload failed:", error.message);
    res.status(500).json({ success: false, error: "File uploaded, but data insert failed." });
  }
});

/* ----------------------------
   History APIs
----------------------------- */

// List history (latest first)
app.get("/api/uploads", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("uploads_log")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    res.json({ success: true, uploads: data || [] });
  } catch (err) {
    console.error("/api/uploads error:", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch uploads" });
  }
});

// Fetch rows for an upload
app.get("/api/uploads/:id/data", async (req, res) => {
  const id = Number(req.params.id);
  const limit = Math.min(Number(req.query.limit) || 200, 1000); // cap
  const offset = Number(req.query.offset) || 0;

  try {
    // 1) find the log entry
    const { data: log, error: logErr } = await supabase
      .from("uploads_log")
      .select("*")
      .eq("id", id)
      .single();
    if (logErr || !log) {
      return res.status(404).json({ success: false, error: "Upload not found" });
    }
    const tableName = log.table_name;

    // 2) fetch rows + total count
    const { data: rows, error, count } = await supabase
      .from(tableName)
      .select("*", { count: "exact" })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // 3) columns from first row
    const columns = rows?.[0] ? Object.keys(rows[0]).filter((c) => c !== "id") : [];

    res.json({
      success: true,
      tableName,
      columns,
      total: count ?? rows.length,
      rows: rows || [],
    });
  } catch (err) {
    console.error(`/api/uploads/${req.params.id}/data error:`, err.message);
    res.status(500).json({ success: false, error: "Failed to fetch upload data" });
  }
});

/* ----------------------------
   Logout
----------------------------- */
app.get("/logout", (req, res) => {
  res.redirect("/index.html");
});

/* ----------------------------
   Serve static (AFTER API routes)
----------------------------- */
app.use(express.static(path.join(process.cwd(), "Static")));

/* ----------------------------
   Start server
----------------------------- */
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
