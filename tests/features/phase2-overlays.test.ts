import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import test from "node:test";
import { Popover, Tooltip } from "../../src/components/ui.jsx";

void test("P2-T12 Popover trigger has explicit expandable dialog semantics", () => {
  const markup = renderToStaticMarkup(React.createElement(Popover, {
    label: "更多操作",
    trigger: "更多",
    children: React.createElement("button", { type: "button" }, "存档"),
  }));
  assert.match(markup, /aria-haspopup="dialog"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /aria-label="更多操作"/);
});

void test("P2-T12 Tooltip keeps the required visible control in the DOM", () => {
  const markup = renderToStaticMarkup(React.createElement(Tooltip, {
    label: "打开帮助",
    children: React.createElement("button", { type: "button", "aria-label": "帮助" }, "?"),
  }));
  assert.match(markup, /aria-label="帮助"/);
  assert.doesNotMatch(markup, /role="tooltip"/);
});
