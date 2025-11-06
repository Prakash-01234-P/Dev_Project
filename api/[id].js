// api/uploads/[id].js
import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get("/", async (req, res) => {
  try {
    const id = Number(req.query.id || req.params.id);
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const offset = Number(req.query.offset) || 0;

    if (!id) return res.status(400).json({ success: false, message: "Missing id" });

    // get log row
    const { data: log, error: logErr } = await supabase
      .from("uploads_log")
      .select("*")
      .eq("id", id)
      .single();
    if (logErr || !log) return res.status(404).json({ success: false, message: "Not found" });

    const table = log.table_name;
    const { data: rows, error, count } = await supabase
      .from(table)
      .select("*", { count: "exact" })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const cols = rows[0] ? Object.keys(rows[0]).filter((c) => c !== "id") : [];
    res.status(200).json({
      success: true,
      tableName: table,
      columns: cols,
      rows,
      total: count ?? rows.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default (req, res) => app(req, res);
