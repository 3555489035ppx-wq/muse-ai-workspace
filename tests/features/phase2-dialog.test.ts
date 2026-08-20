import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import test from "node:test";
import { ConfirmDialog, Modal } from "../../src/components/ui.jsx";

void test("P2-T11 closed modal does not leak dialog content", () => {
  const markup = renderToStaticMarkup(React.createElement(Modal, {
    open: false,
    title: "档案项目",
    description: "项目将移入回收站",
    onClose: () => undefined,
  }));
  assert.equal(markup, "");
});

void test("P2-T11 confirmation exposes loading and safe cancel state", () => {
  const markup = renderToStaticMarkup(React.createElement(ConfirmDialog, {
    open: true,
    title: "移入回收站",
    description: "这是一段需要被对话框命名的说明。",
    confirmText: "确认移入",
    onCancel: () => undefined,
    onConfirm: () => undefined,
    danger: true,
    loading: true,
  }));
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /aria-describedby=/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /button--danger/);
  assert.equal((markup.match(/disabled/g) ?? []).length >= 2, true);
});
