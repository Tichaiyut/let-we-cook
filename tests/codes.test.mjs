import assert from "node:assert/strict";
import test from "node:test";
import { suggestCode } from "../src/lib/codes.js";

test("builds a readable 3-character code from the name", () => {
  assert.equal(suggestCode("Power BI"), "PBI");
  assert.equal(suggestCode("AI Lab"), "AIL");
  assert.equal(suggestCode("Performance Dashboard"), "PDA");
  assert.equal(suggestCode("Daily Entry"), "DEN");
  assert.equal(suggestCode("Notification"), "NOT");
  assert.equal(suggestCode("Super App Mobile"), "SAM");
  assert.equal(suggestCode("SuperAPP"), "SAP");
  assert.equal(suggestCode("iFarm ไก่ไข่"), "IFA");
  assert.equal(suggestCode("HMI"), "HMI");
});

test("pads names that are too short", () => {
  assert.equal(suggestCode("AI"), "AIX");
  assert.equal(suggestCode("Q"), "QXX");
});

test("never returns a code that is already taken", () => {
  assert.equal(suggestCode("iFarm ไก่เนื้อ", ["IFA"]), "IFR");
  assert.equal(suggestCode("iFarm", ["IFA", "IFR"]), "IFM");
  assert.equal(suggestCode("AI", ["AIX"]), "AI1");
  assert.equal(suggestCode("power bi", ["pbi"]), "POW");
});

test("falls back to numbered codes for names without Latin letters", () => {
  assert.equal(suggestCode("ระบบแจ้งเตือน"), "M01");
  assert.equal(suggestCode("หน้าจอหลัก", ["C01"], "C"), "C02");
  assert.equal(suggestCode(""), "M01");
});
