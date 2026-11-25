import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";
import { config } from "./config.js";
import { listAgents, runOrchestrator, ProviderError, type AgentRole } from "./agents.js";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "256kb" }));

function authenticate(req: Request, res: Response, next: NextFunction) {
  if (!config.apiKey) {
    res.status(503).json({ error: "Server is not configured: set API_KEY before enabling API access." });
    return;
  }
  const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied || supplied !== config.apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const chatSchema = z.object({
  message: z.string().min(1).max(config.maxPromptChars),
  role: z.enum(["research", "coding", "analysis", "writing", "review"]).optional(),
  provider: z.string().optional(),
  system: z.string().max(5000).optional()
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "ai-unlimited-agents", version: "0.1.0" }));
app.get("/v1/agents", authenticate, (_req, res) => res.json({ agents: listAgents(), providers: config.providers.map(p => ({ name: p.name, model: p.model })) }));
app.post("/v1/chat", authenticate, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  try {
    const result = await runOrchestrator(parsed.data as {message: string; role?: AgentRole; provider?: string; system?: string});
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = error instanceof ProviderError ? 503 : 502;
    return res.status(status).json({ error: message });
  }
});

app.listen(config.port, () => {
  console.log(`AI UNLIMITED AGENTS API listening on port ${config.port}`);
});
