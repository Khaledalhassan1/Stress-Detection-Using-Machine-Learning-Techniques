import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { spawn } from "child_process";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  const systemPrompt = `
You give short, direct, helpful answers.
Do NOT introduce yourself.
Do NOT mention being an assistant or AI.
Do NOT add extra information.
Answer ONLY what the user asks.
If asked about stress metrics (Body temperature, EDA, BVP, Movement), explain briefly.
If unclear, ask a short clarifying question.
No medical diagnosis.
`;

  const finalPrompt = `${systemPrompt}\nUser: ${userMessage}\nAssistant:`;

  // Start Ollama
  const ollama = spawn("ollama", ["run", "llama3.2:latest"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let output = "";

  ollama.stdout.on("data", (data) => {
    output += data.toString();
  });

  // Ignore stderr noise
  ollama.stderr.on("data", () => {});

  ollama.on("close", () => {
    res.json({ reply: output.trim() });
  });

  ollama.stdin.write(finalPrompt);
  ollama.stdin.end();
});

app.listen(3000, () => {
  console.log("API running on http://localhost:3000");
});
