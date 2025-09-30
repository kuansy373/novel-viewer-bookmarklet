const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const DATA_FILE = 'onetap.json';

// 保存
app.post('/save', (req, res) => {
  const {
    name,
    color,
    backgroundColor,
    fontSize,
    fontWeight,
    textShadow,
    fontFamily,
    scrollSettings
  } = req.body;
  if (!name) return res.status(400).send({ error: 'スタイル名が必要です' });

  let allData = {};
  if (fs.existsSync(DATA_FILE)) {
    allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }

  allData[name] = {
    color,
    backgroundColor,
    fontSize,
    fontWeight,
    textShadow,
    fontFamily,
    scrollSettings: scrollSettings || null };
  fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));

  res.send({ status: 'ok', name, ...allData[name] });
});

// 取得
app.get('/get/:name', (req, res) => {
  const name = req.params.name;
  if (!fs.existsSync(DATA_FILE)) return res.send(null);
  const allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  res.send(allData[name] || null);
});
// 全件取得(ブラウザで確認する用)
app.get('/getAll', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.send({});
  const allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  res.send(allData);
});

app.listen(PORT, () => {
  console.log(`Local server running at http://localhost:${PORT}`);
});
