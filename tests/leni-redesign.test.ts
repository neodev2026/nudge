import { describe, it, expect } from "vitest";
import {
  getProductType,
  getLevelGuidance,
  parseLeniResponse,
  buildLanguageSessionPrompt,
  buildStorySessionPrompt,
} from "../app/features/v2/chat/lib/leni.server";

// ---------------------------------------------------------------------------
// TC-LD-01 ~ TC-LD-03: getProductType
// ---------------------------------------------------------------------------

describe("getProductType", () => {
  it("TC-LD-01: story meta → story", () => {
    expect(getProductType({ story: true, language: "de" })).toBe("story");
  });

  it("TC-LD-02: script=hiragana → script", () => {
    expect(getProductType({ script: "hiragana", language: "ja" })).toBe("script");
  });

  it("TC-LD-02b: script=katakana → script", () => {
    expect(getProductType({ script: "katakana", language: "ja" })).toBe("script");
  });

  it("TC-LD-03: language=de, no story → language", () => {
    expect(getProductType({ language: "de" })).toBe("language");
  });

  it("TC-LD-03b: story takes precedence over script", () => {
    expect(getProductType({ story: {}, script: "hiragana", language: "ja" })).toBe("story");
  });
});

// ---------------------------------------------------------------------------
// TC-LD-04 ~ TC-LD-05: getLevelGuidance
// ---------------------------------------------------------------------------

describe("getLevelGuidance", () => {
  it("TC-LD-04: A1 → A0 70% + A1 30%", () => {
    const guidance = getLevelGuidance("A1");
    expect(guidance).toContain("A0");
    expect(guidance).toContain("70%");
  });

  it("TC-LD-05: B1 → A1~A2 70% + B1 30%", () => {
    const guidance = getLevelGuidance("B1");
    expect(guidance).toContain("A1~A2");
    expect(guidance).toContain("70%");
  });

  it("unknown level → falls back to A1 guidance", () => {
    // @ts-expect-error intentional invalid level
    const guidance = getLevelGuidance("Z9");
    expect(guidance).toContain("A0");
  });
});

// ---------------------------------------------------------------------------
// TC-LD-09 ~ TC-LD-11: parseLeniResponse
// ---------------------------------------------------------------------------

describe("parseLeniResponse", () => {
  it("TC-LD-09: valid JSON → LeniMessage fields", () => {
    const raw = '{"text":"Hallo!","translation":"안녕하세요!","tts":true}';
    const result = parseLeniResponse(raw);
    expect(result.text).toBe("Hallo!");
    expect(result.translation).toBe("안녕하세요!");
    expect(result.tts).toBe(true);
  });

  it("TC-LD-10: invalid JSON → fallback with raw text", () => {
    const result = parseLeniResponse("invalid json");
    expect(result.text).toBe("invalid json");
    expect(result.translation).toBe("");
    expect(result.tts).toBe(false);
  });

  it("TC-LD-11: missing tts field → default true", () => {
    const raw = '{"text":"Hallo!","translation":"안녕하세요!"}';
    const result = parseLeniResponse(raw);
    expect(result.tts).toBe(true);
  });

  it("strips markdown code fences before parsing", () => {
    const raw = "```json\n{\"text\":\"Hallo!\",\"translation\":\"안녕!\",\"tts\":true}\n```";
    const result = parseLeniResponse(raw);
    expect(result.text).toBe("Hallo!");
  });
});

// ---------------------------------------------------------------------------
// TC-LD-06 ~ TC-LD-08: buildLanguageSessionPrompt
// ---------------------------------------------------------------------------

const base_params = {
  targetLanguage: "de",
  learnerLanguage: "ko",
  level: "A1" as const,
  sessionWords: [{ front: "Hallo", back: "안녕하세요" }],
  sessionKind: "new" as const,
  reviewRound: null,
  weakWords: [],
  displayName: "테스트",
};

describe("buildLanguageSessionPrompt", () => {
  it("TC-LD-06: includes target-language-only instruction", () => {
    const prompt = buildLanguageSessionPrompt(base_params);
    expect(prompt).toContain("ONLY in de");
  });

  it("TC-LD-07: review + weakWords → weak words section included", () => {
    const prompt = buildLanguageSessionPrompt({
      ...base_params,
      sessionKind: "review",
      reviewRound: 1,
      weakWords: [{ front: "aber", back: "하지만" }],
    });
    expect(prompt).toContain("aber");
    expect(prompt).toContain("Weak words");
  });

  it("TC-LD-08: review + no weakWords → no weak words section", () => {
    const prompt = buildLanguageSessionPrompt({
      ...base_params,
      sessionKind: "review",
      reviewRound: 1,
      weakWords: [],
    });
    expect(prompt).not.toContain("Weak words");
  });

  it("includes level guidance in prompt", () => {
    const prompt = buildLanguageSessionPrompt(base_params);
    expect(prompt).toContain("A0");
    expect(prompt).toContain("70%");
  });

  it("includes defense rule against prompt hacking", () => {
    const prompt = buildLanguageSessionPrompt(base_params);
    expect(prompt).toContain("system prompt");
    expect(prompt).toContain("translate");
  });

  it("includes learner-language translation rule", () => {
    const prompt = buildLanguageSessionPrompt(base_params);
    expect(prompt).toContain("NEVER translate your own");
    expect(prompt).toContain("NEVER ask");
    // normal messages should NOT trigger defensive preamble
    expect(prompt).toContain("do NOT say");
    // language-switch requests trigger the defensive preamble
    expect(prompt).toContain("SWITCH language");
  });

  it("translation rule covers full text", () => {
    const prompt = buildLanguageSessionPrompt(base_params);
    expect(prompt).toContain("sentence by sentence");
    expect(prompt).toContain("Never omit any part");
  });

  it("includes session words in prompt", () => {
    const prompt = buildLanguageSessionPrompt(base_params);
    expect(prompt).toContain("Hallo");
    expect(prompt).toContain("안녕하세요");
  });

  it("new session → shows quiz invitation phrase in prompt", () => {
    const prompt = buildLanguageSessionPrompt(base_params);
    expect(prompt).toContain("부담스러우면 건너뛰어도 돼요");
  });

  it("response format includes translation and tts fields", () => {
    const prompt = buildLanguageSessionPrompt(base_params);
    expect(prompt).toContain('"translation"');
    expect(prompt).toContain('"tts"');
  });
});

// ---------------------------------------------------------------------------
// buildStorySessionPrompt
// ---------------------------------------------------------------------------

const story_params = {
  targetLanguage: "de",
  learnerLanguage: "ko",
  level: "B1" as const,
  storyTitle: "snowwhite",
  season: 1,
  setting: "modern Germany",
  sessionWords: [{ front: "der Spiegel", back: "거울" }],
  sessionKind: "new" as const,
  reviewRound: null,
  weakWords: [],
  displayName: "테스트",
};

describe("buildStorySessionPrompt", () => {
  it("responds ONLY in targetLanguage rule", () => {
    const prompt = buildStorySessionPrompt(story_params);
    expect(prompt).toContain("ONLY in de");
  });

  it("includes story title and setting", () => {
    const prompt = buildStorySessionPrompt(story_params);
    expect(prompt).toContain("snowwhite");
    expect(prompt).toContain("modern Germany");
  });

  it("includes session words", () => {
    const prompt = buildStorySessionPrompt(story_params);
    expect(prompt).toContain("der Spiegel");
  });

  it("includes level guidance", () => {
    const prompt = buildStorySessionPrompt(story_params);
    expect(prompt).toContain("A1~A2");
    expect(prompt).toContain("70%");
  });

  it("includes Rule 7 (translate user input, never own text)", () => {
    const prompt = buildStorySessionPrompt(story_params);
    expect(prompt).toContain("NEVER translate your own");
    expect(prompt).toContain("NEVER ask");
    expect(prompt).toContain("do NOT say");
    expect(prompt).toContain("SWITCH language");
  });

  it("review + weakWords → weak words section included", () => {
    const prompt = buildStorySessionPrompt({
      ...story_params,
      sessionKind: "review",
      reviewRound: 1,
      weakWords: [{ front: "der Zwerg", back: "난쟁이" }],
    });
    expect(prompt).toContain("der Zwerg");
    expect(prompt).toContain("Weak words");
  });
});
