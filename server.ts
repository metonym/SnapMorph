import cors from 'cors';
import express, { Request, Response } from 'express';

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.json({ message: 'Hello from SnapMorph backend!' });
});

app.post('/snapshot', (req, res) => {
  const { snapshot } = req.body;
  if (!snapshot) {
    res.status(400).json({ error: 'Missing snapshot in request body' });
    return;
  }
  const snapshotStr = JSON.stringify(snapshot);
  console.log('[SnapMorph] Received snapshot:', snapshotStr.slice(0, 100));
  res.json({ message: 'Snapshot received', snapshot });
});

app.listen(PORT, () => {
  console.log(`SnapMorph backend listening at http://localhost:${PORT}`);
}); 