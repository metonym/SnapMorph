import cors from "cors";
import express from "express";
import { OpenAI } from "openai";
import { OPENAI_API_KEY, PORT } from "./constants";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.json({ message: "Hello from SnapMorph backend!" });
});

app.post("/snapshot", async (req, res) => {
  const { snapshot, serialized } = req.body;
  if (!snapshot) {
    res.status(400).json({ error: "Missing snapshot in request body" });
    return;
  }

  if (!serialized) {
    res.status(400).json({ error: "Missing serialized in request body" });
    return;
  }

  const snapshotStr = JSON.stringify(snapshot);
  console.log("[SnapMorph] Received snapshot:", snapshotStr.slice(0, 100));
  console.log("[SnapMorph] Received serialized:", serialized);

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say hello world" },
    ],
  });
  const result = completion.choices[0]?.message?.content || "No response";
  console.log("[OpenAI] Response:", result);

  res.json({ message: "Snapshot received", snapshot });
});

app.listen(PORT, () => {
  console.log(`SnapMorph backend listening at http://localhost:${PORT}`);
});
