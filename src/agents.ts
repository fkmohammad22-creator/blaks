import { config, type ProviderConfig } from "./config.js";

export type AgentRole = "research" | "coding" | "analysis" | "writing" | "review";
export type ChatInput = { message: string; role?: AgentRole; provider?: string; system?: string };

const prompts: Record<AgentRole, string> = {
  research: "You are a careful research assistant. Separate verified facts from uncertainty and cite sources only when supplied.",
  coding: "You are a senior software engineer. Produce correct, secure, maintainable code and explain important tradeoffs.",
  analysis: "You are a rigorous analyst. Structure the problem, state assumptions, compare options, and give a reasoned conclusion.",
  writing: "You are an expert writer. Match the requested language, audience, tone, and format.",
  review: "You are an independent reviewer. Identify factual gaps, unsafe assumptions, bugs, and improvements. Do not invent verification."
};

export class ProviderError extends Error {}

function chooseProvider(requested?: string): ProviderConfig {
  if (!config.providers.length) throw new ProviderError("No provider is configured. Add at least one provider API key.");
  if (requested && requested !== "auto") {
    const match = config.providers.find(p => p.name.toLowerCase() === requested.toLowerCase());
    if (!match) throw new ProviderError(`Provider '${requested}' is not configured.`);
    return match;
  }
  if (config.defaultProvider !== "auto") {
    const match = config.providers.find(p => p.name.toLowerCase() === config.defaultProvider.toLowerCase());
    if (match) return match;
  }
  return config.providers[0];
}

async function complete(provider: ProviderConfig, messages: Array<{role: string; content: string}>): Promise<{content: string; model: string}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: provider.model, messages, temperature: 0.3 }),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1200);
      throw new ProviderError(`${provider.name} returned HTTP ${response.status}: ${detail}`);
    }
    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new ProviderError("Provider returned an unexpected response format.");
    return { content, model: data.model || provider.model };
  } finally {
    clearTimeout(timeout);
  }
}

export function listAgents() {
  return Object.entries(prompts).map(([id, description]) => ({ id, description }));
}

export async function runAgent(input: ChatInput) {
  const provider = chooseProvider(input.provider);
  const role = input.role || "analysis";
  const system = input.system?.trim() || prompts[role];
  const result = await complete(provider, [
    { role: "system", content: system },
    { role: "user", content: input.message }
  ]);
  return { ...result, agent: role, provider: provider.name };
}

export async function runOrchestrator(input: ChatInput) {
  const primary = await runAgent({ ...input, role: input.role || "analysis" });
  return {
    answer: primary.content,
    orchestration: {
      mode: "single-specialist",
      agent: primary.agent,
      provider: primary.provider,
      model: primary.model,
      note: "Multi-agent delegation is the next implementation milestone; this initial release establishes the provider and agent runtime."
    }
  };
}
