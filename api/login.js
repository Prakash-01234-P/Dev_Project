import express from "express";
import bodyParser from "body-parser";

// Create an Express app
const app = express();
app.use(bodyParser.json());

// Define route
app.post("/", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "admin123") {
    res.status(200).json({ success: true, redirect: "/home.html" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Export the handler function for Vercel
export default (req, res) => {
  app(req, res);
};
