import assert from "node:assert/strict";
import test from "node:test";
import { asEntityId } from "../../src/domain/shared/id.js";
import { MoodboardProviderError, validateMoodboardProviderOutput, type MoodboardProviderOutput } from "../../src/application/moodboard/index.js";

const asset = asEntityId("32000000-0000-4000-8000-000000000001");
const territory = (key: string): MoodboardProviderOutput["territories"][number] => ({ key, name: `方向 ${key}`, rationale: "从研究证据形成视觉领地", keywords: ["清晰", "材料", "节奏"], assetRefs: [asset], visualDNA: { keywords: ["清晰", "材料", "节奏"], colorPalette: [{ hex: "#111111", role: "主色" }, { hex: "#EEEEEE", role: "背景" }, { hex: "#8A6C4B", role: "强调" }], composition: ["非对称网格"], imagery: ["纪实特写"], typography: ["中文黑体"], materials: ["触感纸" ] } });

void test("moodboard contract accepts two to four complete territories", () => {
  const output = { territories: [territory("a"), territory("b")] };
  assert.equal(validateMoodboardProviderOutput(output, [asset]), output);
});

void test("moodboard contract rejects quantity, incomplete DNA and unavailable assets", () => {
  assert.throws(() => validateMoodboardProviderOutput({ territories: [territory("a")] }, [asset]), MoodboardProviderError);
  assert.throws(() => validateMoodboardProviderOutput({ territories: [{ ...territory("a"), assetRefs: [asEntityId("32000000-0000-4000-8000-000000000099")] }, territory("b")] }, [asset]), MoodboardProviderError);
  assert.throws(() => validateMoodboardProviderOutput({ territories: [{ ...territory("a"), visualDNA: { ...territory("a").visualDNA, materials: [] } }, territory("b")] }, [asset]), MoodboardProviderError);
});
