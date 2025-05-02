import cors from "cors";
import express from "express";
import { PORT } from "./constants";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Hello from SnapMorph backend!" });
});

app.listen(PORT, () => {
  console.log(`SnapMorph backend listening at http://localhost:${PORT}`);
});
