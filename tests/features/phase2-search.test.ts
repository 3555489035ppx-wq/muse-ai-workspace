import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import test from "node:test";
import { handleSearchKeyDown, SearchInput } from "../../src/components/ui.jsx";

void test("P2-T08 renders one labelled search, clear action and result status", () => {
  const markup = renderToStaticMarkup(React.createElement(SearchInput, {
    label: "搜索项目",
    onChange: () => undefined,
    placeholder: "搜索项目名称",
    resultCount: 2,
    value: "山西",
  }));
  assert.match(markup, /role="search"/);
  assert.match(markup, /aria-label="搜索项目"/);
  assert.match(markup, /aria-label="清除搜索项目"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /找到 2 条结果/);
});

void test("P2-T08 clears on Escape and prevents accidental Enter submit", () => {
  const values: string[] = [];
  let prevented = 0;
  const onChange = (event: { target: { value: string } }) => values.push(event.target.value);
  const escape = handleSearchKeyDown({ key: "Escape", preventDefault: () => { prevented += 1; } }, "query", onChange);
  const enter = handleSearchKeyDown({ key: "Enter", preventDefault: () => { prevented += 1; } }, "query", onChange);
  assert.equal(escape, "clear");
  assert.equal(enter, "prevent-submit");
  assert.deepEqual(values, [""]);
  assert.equal(prevented, 2);
});
