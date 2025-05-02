import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { RIME_API_KEY } from "./constants";

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.json({ message: "Hello from SnapMorph backend!" });
});

app.post("/snapshot", (req, res) => {
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

  res.json({ message: "Snapshot received", snapshot });
});

// Proxy endpoint to stream MP3 from Rime TTS API
app.post("/tts", async (req, res) => {
  const {
    speaker,
    text,
    modelId = "arcana",
    repetition_penalty = 1.5,
    temperature = 0.5,
    top_p = 0.5,
    max_tokens = 1200,
  } = req.body;

  if (!speaker || !text || !RIME_API_KEY) {
    res
      .status(400)
      .json({
        error:
          "Missing required fields: speaker, text, or RIME_API_KEY constant",
      });
    return;
  }

  try {
    const rimeRes = await fetch("https://users.rime.ai/v1/rime-tts", {
      method: "POST",
      headers: {
        Accept: "audio/mp3",
        Authorization: RIME_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        speaker,
        text,
        modelId,
        repetition_penalty,
        temperature,
        top_p,
        max_tokens,
      }),
    });

    if (!rimeRes.ok || !rimeRes.body) {
      res.status(500).json({ error: "Failed to fetch TTS audio" });
      return;
    }

    res.setHeader("Content-Type", "audio/mp3");
    if (rimeRes.body) {
      // @ts-expect-error: Node.js and Web Streams API type mismatch, safe to ignore for this use
      const nodeStream = Readable.fromWeb(rimeRes.body);
      nodeStream.pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: "TTS proxy error", details: String(err) });
  }
});

// Create an MCP server
const server = new McpServer({
  name: "Demo",
  version: "1.0.0",
});

// Add an addition tool
server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a + b) }],
}));

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${name}!`,
      },
    ],
  }),
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

app.listen(PORT, () => {
  console.log(`SnapMorph backend listening at http://localhost:${PORT}`);
});
