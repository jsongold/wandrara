// Anthropic Messages API を 1 回呼ぶ（SDK は入れない）。環境変数 ANTHROPIC_API_KEY
export const HAIKU = "claude-haiku-5-5";
export const SONNET = "claude-sonnet-5-5";

export async function complete(model: string, system: string, user: string, maxTokens = 1500): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("環境変数 ANTHROPIC_API_KEY が無い");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}
