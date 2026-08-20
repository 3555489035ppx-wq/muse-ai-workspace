import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import test from "node:test";
import { Field } from "../../src/components/ui.jsx";

void test("P2-T07 associates label, hint and error with a direct control", () => {
  const markup = renderToStaticMarkup(React.createElement(Field, {
    children: React.createElement("input", { defaultValue: "保留的输入" }),
    error: "请输入完整名称",
    hint: "用于项目列表",
    id: "project-name",
    label: "项目名称",
  }));
  assert.match(markup, /for="project-name"/);
  assert.match(markup, /aria-describedby="project-name-hint project-name-error"/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /value="保留的输入"/);
});

void test("P2-T07 keeps render-prop controls programmatically labelled", () => {
  const markup = renderToStaticMarkup(React.createElement(Field, {
    children: (id: string) => React.createElement("textarea", { id, defaultValue: "已有内容" }),
    error: undefined,
    hint: undefined,
    id: "brief",
    label: "设计需求",
  }));
  assert.match(markup, /for="brief"/);
  assert.match(markup, /id="brief"/);
  assert.match(markup, />已有内容<\/textarea>/);
});
