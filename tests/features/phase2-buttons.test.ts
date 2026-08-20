import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import test from "node:test";
import { Button, IconButton } from "../../src/components/ui.jsx";

void test("P2-T06 maps legacy and new button variants to one anatomy", () => {
  const primary = renderToStaticMarkup(React.createElement(Button, { children: "继续", icon: null }));
  const ghost = renderToStaticMarkup(React.createElement(Button, { children: "稍后", icon: null, variant: "ghost" }));
  assert.match(primary, /type="button"/);
  assert.match(primary, /button--default button--primary/);
  assert.match(ghost, /button--ghost/);
});

void test("P2-T06 exposes loading, disabled and icon accessible state", () => {
  const loading = renderToStaticMarkup(React.createElement(Button, { children: "生成", icon: null, loading: true }));
  const icon = renderToStaticMarkup(React.createElement(IconButton, { children: "×", label: "关闭" }));
  assert.match(loading, /disabled=""/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(icon, /aria-label="关闭"/);
  assert.match(icon, /type="button"/);
});
