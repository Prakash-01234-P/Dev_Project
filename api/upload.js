// api/upload.js
import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const sqlQuote = (v) => String(v ?? "").replace(/'/g, "''");

async function ensureLogTable() {
  await supabase.rpc("execute_sql", {
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
}

app.post("/", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No file uploaded" });

    await ensureLogTable();

    // 1) Upload to storage
    const filePath = `uploads/${Date.now()}_${file.originalname}`;
    const { error: uploadErr } = await supabase.storage
      .from("uploads")
      .upload(filePath, file.buffer, {
        upsert: false,
        contentType: file.mimetype,
      });
    if (uploadErr) throw uploadErr;

    // 2) Parse Excel
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    if (sheetData.length === 0) {
      return res.status(400).json({ success: false, message: "Empty file" });
    }

    // 3) Create dynamic table
    const tableName = `excel_data_${Date.now()}`;
    const columns = Object.keys(sheetData[0])
      .map((c) => `"${c}" text`)
      .join(", ");
    const { error: createErr } = await supabase.rpc("execute_sql", {
      sql: `CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, ${columns});`,
    });
    if (createErr) throw createErr;

    // 4) Insert rows
    for (const row of sheetData) {
      const keys = Object.keys(row).map((k) => `"${k}"`).join(", ");
      const vals = Object.values(row).map((v) => `'${sqlQuote(v)}'`).join(", ");
      const { error: insErr } = await supabase.rpc("execute_sql", {
        sql: `INSERT INTO ${tableName} (${keys}) VALUES (${vals});`,
      });
      if (insErr) throw insErr;
    }

    // 5) Log upload
    const rowsCount = sheetData.length;
    await supabase.rpc("execute_sql", {
      sql: `
        INSERT INTO uploads_log (filename, table_name, rows_count)
        VALUES ('${sqlQuote(file.originalname)}', '${sqlQuote(tableName)}', ${rowsCount});
      `,
    });

    // 6) Get public URL
    const { data: pub } = supabase.storage.from("uploads").getPublicUrl(filePath);

    // 7) Send preview
    const preview = sheetData.slice(0, 20);
    res.status(200).json({
      success: true,
      message: "File uploaded successfully!",
      file_url: pub?.publicUrl || null,
      tableName,
      rowsCount,
      preview,
    });
  } catch (err) {
    console.error("upload error:", err.message);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

export default (req, res) => app(req, res);
