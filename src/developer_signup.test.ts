import { decideSignup } from "./developer_signup.ts";

process.env.INFRAI_API_KEY = "test-key";
const input = { email: "dev@example.com", password: "correct-horse-battery", widgetRecordId: "test-widget-record", captchaToken: "token", ip: "203.0.113.10", action: "developer_signup" };
const response = (ok: boolean): Response => new Response(JSON.stringify(ok ? { ok: true, data: { verified: true } } : { ok: false, error: { message: "Captcha was rejected" } }), { status: ok ? 200 : 422, headers: { "content-type": "application/json" } });
const reject = await decideSignup(input, async () => response(false));
if (reject.status !== "rejected") throw new Error("rejected captcha must reject signup");
const allow = await decideSignup(input, async () => response(true));
if (allow.status !== "allowed") throw new Error("verified captcha must allow signup");
console.log("signup decision test passed");
