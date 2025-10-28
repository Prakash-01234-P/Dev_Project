import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

app.post('*', (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === 'admin123') {
    res.status(200).json({ success: true, redirect: '/home.html' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

export default app;
