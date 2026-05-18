import { describe, it, expect } from "vitest";
import {
  serializeHyperSyncMessageBody,
  parseHyperSyncMessageBody,
} from "../app/features/v2/hyper-sync/lib/message-body";

describe("serializeHyperSyncMessageBody", () => {
  it("encodes pipe-delimited body with comma-separated card ids", () => {
    const body = {
      productSlug: "developer-english",
      sourceSessionId: "11111111-1111-1111-1111-111111111111",
      cardIds: [
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      ],
      totalUnknown: 2,
    };
    expect(serializeHyperSyncMessageBody(body)).toBe(
      "hyper_sync|developer-english|11111111-1111-1111-1111-111111111111|aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb|2"
    );
  });

  it("encodes empty card list as empty segment", () => {
    const body = {
      productSlug: "developer-english",
      sourceSessionId: "abc",
      cardIds: [],
      totalUnknown: 0,
    };
    expect(serializeHyperSyncMessageBody(body)).toBe(
      "hyper_sync|developer-english|abc||0"
    );
  });
});

describe("parseHyperSyncMessageBody", () => {
  it("roundtrip: parse(serialize(body)) === body", () => {
    const body = {
      productSlug: "developer-english",
      sourceSessionId: "session-1",
      cardIds: ["card-1", "card-2", "card-3"],
      totalUnknown: 3,
    };
    expect(parseHyperSyncMessageBody(serializeHyperSyncMessageBody(body))).toEqual(body);
  });

  it("returns null for null/undefined/empty input", () => {
    expect(parseHyperSyncMessageBody(null)).toBeNull();
    expect(parseHyperSyncMessageBody(undefined)).toBeNull();
    expect(parseHyperSyncMessageBody("")).toBeNull();
  });

  it("returns null when prefix is wrong", () => {
    expect(parseHyperSyncMessageBody("marathon|slug|session|cards|1")).toBeNull();
  });

  it("returns null when not enough segments", () => {
    expect(parseHyperSyncMessageBody("hyper_sync|slug|session")).toBeNull();
  });

  it("returns null when productSlug is empty", () => {
    expect(parseHyperSyncMessageBody("hyper_sync||session|c1|1")).toBeNull();
  });

  it("returns null when sourceSessionId is empty", () => {
    expect(parseHyperSyncMessageBody("hyper_sync|slug||c1|1")).toBeNull();
  });

  it("returns null when total is not a number", () => {
    expect(parseHyperSyncMessageBody("hyper_sync|slug|session|c1|NaN")).toBeNull();
  });

  it("parses empty card ids when middle segment is empty", () => {
    expect(parseHyperSyncMessageBody("hyper_sync|slug|session||0")).toEqual({
      productSlug: "slug",
      sourceSessionId: "session",
      cardIds: [],
      totalUnknown: 0,
    });
  });

  it("filters blank entries within comma-split ids", () => {
    expect(parseHyperSyncMessageBody("hyper_sync|slug|session|c1,,c2|2")).toEqual({
      productSlug: "slug",
      sourceSessionId: "session",
      cardIds: ["c1", "c2"],
      totalUnknown: 2,
    });
  });
});
