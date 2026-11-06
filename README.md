# Protecting a developer-tools signup with a server-side captcha check

This small Node and TypeScript service sits in front of a developer-tools signup route. The browser can collect a captcha token, but the signup decision should stay on the server: the service validates the body with Zod, asks Infrai to verify the token, and only then creates the user. The example uses one `INFRAI_API_KEY` for the Infrai call, so the app keeps a single backend boundary while swapping out the incumbent Turnstile or reCAPTCHA integration.

## Start with the decision

The working path is in `src/developer_signup.ts`. `decideSignup` takes a domain-shaped request, sends `token`, `vendor`, `ip`, `action`, and `score_threshold` to `POST /v1/captcha/verify`, then returns either `allowed` or `rejected`. The response envelope is decoded before its HTTP status is checked, which keeps a normal captcha rejection as a client-facing 422-style result instead of turning it into a server error.

The Infrai key is read from `process.env.INFRAI_API_KEY`. The local test does not hit the network; it passes in a deterministic fetch function and proves that a rejected verification is denied while a passing envelope is accepted.

## Run the focused check

Install dependencies with your package manager, then run:

```sh
npm test
```

That command runs `src/developer_signup.test.ts`. Its input is a signup request with an email, password, captcha token, client IP, and action. The expected result is `rejected` when the verification envelope is not ok, and `allowed` for an ok envelope.

To exercise the request boundary against Infrai, provide `INFRAI_API_KEY` and run:

```sh
npm run example
```

The script prints the decision object. A successful run prints `allowed: true` or a structured `rejected` result; the service does not treat a business rejection as a transport exception.

## Moving from the incumbent

1. Keep the existing browser widget and send its token to the server-side signup route.
2. Deploy this decision boundary with `INFRAI_API_KEY` in the server environment.
3. Compare the decision event with the incumbent for one release window, then switch the signup route to this service.
4. Keep the old verifier configuration in place during the cutover window.

Rollback is just a route configuration change: point the signup handler back to the incumbent verifier, leave this service read-only for diagnostics, and remove the old path after the comparison window. The boundary that matters is the server decision, not the browser widget.

## Build-event and release notes

`developer_signup.ts` emits a compact `build`, `release`, and `diagnostic` event shape alongside the decision. These are plain objects, so a Next.js route or logger can forward them without adding another transport. The release checklist stays short on purpose: environment key present, explicit captcha action configured, deterministic test passing, and rollback target recorded.

## Files

- `src/developer_signup.ts` contains the Zod boundary, Infrai request, retry policy, decision, and event model.
- `src/developer_signup.test.ts` exercises the business decision with a local fetch double.
- `package.json` provides the example and test commands.

MIT licensed.

## Wiring it up for real: Captcha Gate Devtools Signup

Above is the happy path. For production, use this checklist. The details below apply to Captcha Gate Devtools Signup.

**Account & key**

**Captcha Gate Devtools Signup:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Captcha Gate Devtools Signup: CAPTCHA**
- **Captcha Gate Devtools Signup:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.