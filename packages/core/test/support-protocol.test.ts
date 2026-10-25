import assert from "node:assert/strict";
import { test } from "node:test";
import { formatProtocol, parseProtocol } from "../src/support-protocol.ts";

test("formata o protocolo como GH-número", () => {
  assert.equal(formatProtocol(1042), "GH-1042");
});

test("lê o protocolo digitado de vários jeitos", () => {
  assert.equal(parseProtocol("GH-1042"), 1042);
  assert.equal(parseProtocol("gh1042"), 1042);
  assert.equal(parseProtocol(" #1042 "), 1042);
  assert.equal(parseProtocol("1042"), 1042);
});

test("texto que não é protocolo vira null", () => {
  assert.equal(parseProtocol("pix não caiu"), null);
  assert.equal(parseProtocol("GH-"), null);
  assert.equal(parseProtocol("0"), null);
  assert.equal(parseProtocol(undefined), null);
});
