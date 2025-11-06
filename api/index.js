// api/uploads/index.js
import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("uploads_log")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, uploads: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default (req, res) => app(req, res);
