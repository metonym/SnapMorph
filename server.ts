import cors from "cors";
import express from "express";
import { OpenAI } from "openai";
import { OPENAI_API_KEY, PORT } from "./constants";

const app = express();

// Add request timeout and cleanup mechanism
const activeConnections = new Set<express.Response>();
const CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.json({ message: "Hello from SnapMorph backend!" });
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

  // Track active connection
  activeConnections.add(res);

  // Set connection timeout
  const timeoutId = setTimeout(() => {
    if (!res.writableEnded) {
      res.write("data: [TIMEOUT]\n\n");
      res.end();
    }
    activeConnections.delete(res);
  }, CONNECTION_TIMEOUT);

  try {
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
  } catch (error) {
    console.error("[SnapMorph] Error processing snapshot:", error);
    if (!res.writableEnded) {
      res.write(`data: [ERROR] ${error.message}\n\n`);
    }
  } finally {
    clearTimeout(timeoutId);
    activeConnections.delete(res);
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// Cleanup on server shutdown
process.on("SIGTERM", () => {
  for (const connection of activeConnections) {
    if (!connection.writableEnded) {
      connection.write("data: [SHUTDOWN]\n\n");
      connection.end();
    }
  }
  activeConnections.clear();
});

app.listen(PORT, () => {
  console.log(`SnapMorph backend listening at http://localhost:${PORT}`);
});
