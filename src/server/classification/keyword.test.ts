import { describe, expect, it } from "vitest";
import { classifyByVerificationKeyword } from "./keyword";

describe("classifyByVerificationKeyword", () => {
  it("detects conservative Chinese verification keywords", () => {
    expect(classifyByVerificationKeyword("您的验证码是 123456")).toEqual({
      category: "verification",
      source: "keyword"
    });
    expect(classifyByVerificationKeyword("本次校验码为 9876")).toEqual({
      category: "verification",
      source: "keyword"
    });
  });

  it("detects conservative English verification keywords", () => {
    expect(classifyByVerificationKeyword("Your OTP is 123456")).toEqual({
      category: "verification",
      source: "keyword"
    });
    expect(classifyByVerificationKeyword("verification code: 123456")).toEqual({
      category: "verification",
      source: "keyword"
    });
  });

  it("does not classify bare numbers as verification codes", () => {
    expect(classifyByVerificationKeyword("您的编号是 123456")).toBeNull();
  });
});
