import assert from "node:assert/strict";
import test from "node:test";
import { localizeAiFailure } from "../src/lib/ai/errorMessages.js";

test("search configuration failures tell the user what can be fixed", () => {
  const message = localizeAiFailure({ errorCode: "SEARCH_PROVIDER_NOT_CONFIGURED" });
  assert.match(message, /MUSE_SITE_SEARCH_API_KEY/);
  assert.match(message, /手动搜索或添加链接/);
  assert.doesNotMatch(message, /本地服务正在运行/);
});
