import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import test from "node:test";
import {
  CustomSelect,
  nextEnabledOptionIndex,
} from "../../src/components/ui";

const options = [
  { value: "all", label: "全部阶段" },
  { value: "brief", label: "需求确认", disabled: true },
  { value: "research", label: "研究与探索" },
  { value: "review", label: "评审与迭代" },
];

void test("P2-T09 moves through enabled options and wraps at both ends", () => {
  assert.equal(nextEnabledOptionIndex(options, 0, "next"), 2);
  assert.equal(nextEnabledOptionIndex(options, 2, "previous"), 0);
  assert.equal(nextEnabledOptionIndex(options, 3, "next"), 0);
  assert.equal(nextEnabledOptionIndex(options, 0, "previous"), 3);
  assert.equal(nextEnabledOptionIndex(options, 2, "first"), 0);
  assert.equal(nextEnabledOptionIndex(options, 2, "last"), 3);
});

void test("P2-T09 renders a named combobox with the controlled value", () => {
  const html = renderToStaticMarkup(React.createElement(CustomSelect, {
    label: "按阶段筛选",
    value: "research",
    options,
    onChange: () => undefined,
  }));

  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-label="按阶段筛选"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /研究与探索/);
  assert.doesNotMatch(html, /role="listbox"/);
});

void test("P2-T09 exposes the disabled state without opening a native select", () => {
  const html = renderToStaticMarkup(React.createElement(CustomSelect, {
    label: "阶段",
    value: "all",
    options,
    onChange: () => undefined,
    disabled: true,
  }));

  assert.match(html, /disabled/);
  assert.doesNotMatch(html, /<select/);
});
