import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import test from "node:test";
import {
  IconButton,
  nextInteractiveIndex,
  SegmentedControl,
  Tabs,
} from "../../src/components/ui.jsx";

const items = [
  { value: "overview", label: "概览" },
  { value: "disabled", label: "不可用", disabled: true },
  { value: "detail", label: "详情", panelId: "detail-panel" },
];

void test("P2-T10 roving model skips disabled items and wraps", () => {
  assert.equal(nextInteractiveIndex(items, 0, "next"), 2);
  assert.equal(nextInteractiveIndex(items, 2, "next"), 0);
  assert.equal(nextInteractiveIndex(items, 0, "previous"), 2);
});

void test("P2-T10 Tabs expose controlled selected and panel state", () => {
  const markup = renderToStaticMarkup(React.createElement(Tabs, {
    label: "评审视图",
    value: "detail",
    items,
    onChange: () => undefined,
  }));
  assert.match(markup, /role="tablist"/);
  assert.match(markup, /role="tab"/);
  assert.match(markup, /aria-selected="true"/);
  assert.match(markup, /aria-controls="detail-panel"/);
  assert.match(markup, /tabindex="0"/);
});

void test("P2-T10 SegmentedControl and active IconButton expose pressed state", () => {
  const group = renderToStaticMarkup(React.createElement(SegmentedControl, {
    label: "视图",
    value: "overview",
    items,
    onChange: () => undefined,
  }));
  const icon = renderToStaticMarkup(React.createElement(IconButton, {
    label: "网格视图",
    className: "is-active",
    children: "图标",
  }));
  assert.match(group, /role="group"/);
  assert.match(group, /aria-pressed="true"/);
  assert.match(icon, /aria-pressed="true"/);
});
