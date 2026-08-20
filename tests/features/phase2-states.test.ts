import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import test from "node:test";
import {
  Card,
  ErrorState,
  LoadingState,
  Skeleton,
} from "../../src/components/ui.jsx";

void test("P2-T13 Card keeps header, body, footer and actions content-driven", () => {
  const markup = renderToStaticMarkup(React.createElement(Card, {
    header: React.createElement("h3", null, "研究洞察"),
    footer: "3 条证据",
    actions: React.createElement("button", { type: "button" }, "查看"),
    children: "一段会自然换行的长中文内容。",
  }));
  assert.match(markup, /content-card__header/);
  assert.match(markup, /content-card__body/);
  assert.match(markup, /content-card__footer/);
  assert.match(markup, /content-card__actions/);
});

void test("P2-T13 loading, skeleton and retry states expose restrained status semantics", () => {
  const loading = renderToStaticMarkup(React.createElement(LoadingState, { description: "正在读取项目实体" }));
  const skeleton = renderToStaticMarkup(React.createElement(Skeleton, { lines: 4 }));
  const error = renderToStaticMarkup(React.createElement(ErrorState, { description: "请检查本地数据库", onRetry: () => undefined }));
  assert.match(loading, /role="status"/);
  assert.equal((skeleton.match(/aria-hidden="true"/g) ?? []).length, 4);
  assert.match(error, /role="alert"/);
  assert.match(error, />重试</);
});
