import { config, type ProviderConfig } from "./config.js";

export type AgentRole = "research" | "coding" | "analysis" | "writing" | "review";
export type ChatInput = { message: string; role?: AgentRole; provider?: string; system?: string };

const prompts: Record<AgentRole, string> = {
  research: "You are a careful research assistant. Separate verified facts from uncertainty and cite sources only when supplied.",
  coding: "You are a senior software engineer. Produce correct, secure, maintainable code and explain important tradeoffs.",
  analysis: "You are a rigorous analyst. Structure the problem, state assumptions, compare options, and give a reasoned conclusion.",
  writing: "You are an expert writer. Match the requested language, audience, tone, and format.",
  review: "You are an independent quality reviewer. Check the proposed answer for errors, missing caveats, unsafe assumptions, and clarity. Return a corrected final answer, not just a list of criticisms."
};

export class ProviderError extends Error {}

function chooseProvider(requested?: string, exclude?: string): ProviderConfig {
  if (!config.providers.length) throw new ProviderError("No provider is configured. Add at least one provider API key.");
  if (requested && requested !== "auto") {
    const match = config.providers.find(p => p.name.toLowerCase() === requested.toLowerCase());
    if (!match) throw new ProviderError(`Provider '${requested}' is not configured.`);
    return match;
  }
  const available = config.providers.filter(p => p.name !== exclude);
  if (config.defaultProvider !== "auto") {
    const match = available.find(p => p.name.toLowerCase() === config.defaultProvider.toLowerCase());
    if (match) return match;
  }
  return available[0] || config.providers[0];
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

export async function runAgent(input: ChatInput, excludeProvider?: string) {
  const provider = chooseProvider(input.provider, excludeProvider);
  const role = input.role || "analysis";
  const system = input.system?.trim() || prompts[role];
  const result = await complete(provider, [
    { role: "system", content: system },
    { role: "user", content: input.message }
  ]);
  return { ...result, agent: role, provider: provider.name };
}

export async function runOrchestrator(input: ChatInput) {
  const specialist = await runAgent({ ...input, role: input.role || "analysis" });
  const reviewer = await runAgent({
    message: `User request:\n${input.message}\n\nDraft response from ${specialist.agent}:\n${specialist.content}\n\nReview it for correctness, completeness, safety, and clarity. Return the improved final answer while preserving useful details.`,
    role: "review"
  }, specialist.provider);
  return {
    answer: reviewer.content,
    orchestration: {
      mode: "specialist-plus-review",
      agents: [
        { role: specialist.agent, provider: specialist.provider, model: specialist.model },
        { role: reviewer.agent, provider: reviewer.provider, model: reviewer.model }
      ],
      provider_diversity: specialist.provider !== reviewer.provider,
      note: "The task is drafted by a specialist and independently reviewed. Provider diversity depends on the number of configured providers."
    }
  };
}
