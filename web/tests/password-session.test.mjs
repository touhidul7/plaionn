import test from "node:test";
import assert from "node:assert/strict";
import { establishPasswordSession, PASSWORD_LINK_ERROR } from "../src/lib/supabase/password-session.ts";

const session = { data: { session: { user: { id: "invitee" } } }, error: null };
const missing = { data: { session: null }, error: null };

for (const type of ["invite", "recovery"]) {
  test(`${type} fragment establishes the recipient session`, async () => {
    const calls = [];
    await establishPasswordSession({
      setSession: async (tokens) => { calls.push(tokens); return session; },
      getSession: async () => { assert.fail("Must not reuse an existing user's session"); },
    }, `https://app.test/reset-password#access_token=access&refresh_token=refresh&type=${type}`);
    assert.deepEqual(calls, [{ access_token: "access", refresh_token: "refresh" }]);
  });
}

test("waits for automatic PKCE initialization", async () => {
  let finish;
  let ready = false;
  const pending = establishPasswordSession({
    getSession: () => new Promise(resolve => { finish = resolve; }),
    setSession: async () => { assert.fail("PKCE must not be exchanged twice"); },
  }, "https://app.test/reset-password?code=one-time-code").then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(ready, false);
  finish(session);
  await pending;
  assert.equal(ready, true);
});

for (const suffix of ["#error=access_denied&error_code=otp_expired", "?error=confirmation", "#access_token=incomplete"]) {
  test(`rejects invalid links even with an existing session: ${suffix}`, async () => {
    await assert.rejects(establishPasswordSession({
      getSession: async () => session,
      setSession: async () => { assert.fail("Invalid tokens must not be installed"); },
    }, `https://app.test/reset-password${suffix}`), { message: PASSWORD_LINK_ERROR });
  });
}

test("rejects missing sessions and rejected fragment tokens", async () => {
  await assert.rejects(establishPasswordSession({ getSession: async () => missing },
    "https://app.test/reset-password"), { message: PASSWORD_LINK_ERROR });
  await assert.rejects(establishPasswordSession({ setSession: async () => ({ ...missing, error: new Error("expired") }) },
    "https://app.test/reset-password#access_token=expired&refresh_token=expired"), { message: PASSWORD_LINK_ERROR });
});

test("accepts a session established by the server callback", async () => {
  await establishPasswordSession({ getSession: async () => session }, "https://app.test/reset-password");
});
