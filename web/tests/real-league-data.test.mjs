import test from "node:test";
import assert from "node:assert/strict";
import { getUnifiedLeagueGames, getUnifiedLeagueStandings } from "../src/lib/league-standings.ts";
import { sanitizeLeagueName, sanitizePlayerName, sanitizeSeasonName } from "../src/lib/sanitize.ts";

test("empty new and existing leagues never receive fabricated fixtures or standings", () => {
  for (const id of ["ontario", "platform", "60000000-0000-4000-8000-000000000001", "60000000-0000-4000-8000-000000000003"]) {
    assert.deepEqual(getUnifiedLeagueGames(id), []);
    assert.deepEqual(getUnifiedLeagueStandings(id), []);
  }
});

test("display formatting preserves stored names instead of disguising demo records", () => {
  assert.equal(sanitizeLeagueName(" Ontario Central League "), "Ontario Central League");
  assert.equal(sanitizeLeagueName("Client Demo League"), "Client Demo League");
  assert.equal(sanitizePlayerName("Northline Demo Player 1"), "Northline Demo Player 1");
  assert.equal(sanitizeSeasonName("Summer 2027"), "Summer 2027");
  assert.equal(sanitizeSeasonName(null), "Season not configured");
});
