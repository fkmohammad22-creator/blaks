import "dotenv/config";

export type ProviderConfig = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

function provider(prefix: "PROVIDER_A" | "PROVIDER_B"): ProviderConfig | null {
  const apiKey = process.env[`${prefix}_API_KEY`]?.trim();
  if (!apiKey) return null;
  return {
    name: process.env[`${prefix}_NAME`] || prefix,
    baseUrl: (process.env[`${prefix}_BASE_URL`] || "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey,
    model: process.env[`${prefix}_MODEL`] || "gpt-4.1-mini"
  };
}

export const config = {
  port: Number(process.env.PORT || 3000),
  apiKey: process.env.API_KEY || "",
  timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 60000),
  maxPromptChars: Number(process.env.MAX_PROMPT_CHARS || 24000),
  defaultProvider: process.env.DEFAULT_PROVIDER || "auto",
  providers: [provider("PROVIDER_A"), provider("PROVIDER_B")].filter(Boolean) as ProviderConfig[]
};
