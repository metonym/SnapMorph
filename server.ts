import { ApifyClient } from "apify-client";
import cors from "cors";
import express from "express";
import { OpenAI } from "openai";
import { APIFY_API_KEY, OPENAI_API_KEY, PORT } from "./constants";

const client = new ApifyClient({
  token: APIFY_API_KEY,
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.json({ message: "Hello from SnapMorph backend!" });
});

app.get("/apify", async (req, res) => {
  const input = {
    webpageUrl: "https://www.apify.com",
    proxyConfiguration: {
      useApifyProxy: false,
    },
  };

  const run = await client.actor("lpEmfhnyGrnbZt4xO").call(input);

  // Fetch and print Actor results from the run's dataset (if any)
  console.log("Results from dataset");
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  for (const item of items) {
    console.dir(item);
  }

  return res.json({ message: "Apify results fetched" });
});

app.post("/snapshot", async (req, res) => {
  const { snapshot, serialized, optimized } = req.body;
  if (!snapshot) {
    res.status(400).json({ error: "Missing snapshot in request body" });
    return;
  }

  if (!serialized) {
    res.status(400).json({ error: "Missing serialized in request body" });
    return;
  }

  const snapshotStr = JSON.stringify(snapshot);
  console.log("[SnapMorph] Received snapshot:", snapshotStr.slice(0, 10));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a UI design, accessibility, and content expert.",
      },
      {
        role: "user",
        content: `Analyze the following serialized DOM snapshot (it contains markup, styles, and text). Provide recommendations to optimize the accessibility.\n\nFormatting guidelines:\n- Ensure line breaks are provided in the generated markdown.\n- Make the response very direct, concise, and a maximum of 320 characters.\n\nSerialized DOM:\n${optimized}`,
      },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      res.write(`data: ${content}\n\n`);
    }
  }
  res.write("data: [DONE]\n\n");
  res.end();
});

app.listen(PORT, () => {
  console.log(`SnapMorph backend listening at http://localhost:${PORT}`);
});
