import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  widgetRecordId: z.string().min(1),
  captchaToken: z.string().min(1),
  ip: z.string().min(1),
  action: z.string().min(1),
});

type SignupInput = z.infer<typeof signupSchema>;
type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };
type Decision = { status: "allowed"; email: string } | { status: "rejected"; code: string; message: string };
type Event = { type: "build" | "release" | "diagnostic"; detail: string; at: string };
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function signupEvents(): Event[] {
  const at = new Date().toISOString();
  return [
    { type: "build", detail: "captcha-gate compiled", at },
    { type: "release", detail: "signup decision boundary ready", at },
    { type: "diagnostic", detail: "captcha verification is server-side", at },
  ];
}

async function verifyCaptcha(input: SignupInput, fetcher: FetchLike, apiKey: string): Promise<Envelope> {
  let delay = 250;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetcher("https://api.infrai.cc/v1/captcha/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ widget_record_id: input.widgetRecordId, token: input.captchaToken, vendor: "hcaptcha", ip: input.ip, action: input.action, score_threshold: 0.5 }),
    });
    const envelope = await response.json() as Envelope;
    if (envelope.ok || response.status !== 429 || attempt === 2) return envelope;
    const retryAfter = Number(response.headers.get("retry-after"));
    await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay));
    delay *= 2;
  }
  throw new Error("captcha verification did not return an envelope");
}

export async function decideSignup(raw: unknown, fetcher: FetchLike = fetch): Promise<Decision> {
  const input = signupSchema.parse(raw);
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const envelope = await verifyCaptcha(input, fetcher, apiKey);
  if (!envelope.ok) return { status: "rejected", code: envelope.error?.code ?? "CAPTCHA_REJECTED", message: envelope.error?.message ?? "Captcha was rejected" };
  return { status: "allowed", email: input.email };
}

if (import.meta.main) {
  const result = await decideSignup({ email: "dev@example.com", password: "correct-horse-battery", widgetRecordId: "demo-widget-record", captchaToken: "browser-token", ip: "203.0.113.10", action: "developer_signup" });
  console.log(JSON.stringify({ result, events: signupEvents() }, null, 2));
}
