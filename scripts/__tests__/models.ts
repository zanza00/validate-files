import { SemVer } from "../models";
import * as E from "fp-ts/lib/Either";

describe("SemVer Codec", () => {
  it("Can decode a valid codec", () => {
    const goodSemVer = "1.11.1";
    const result = SemVer.decode(goodSemVer);
    expect(result).toEqual(E.right(goodSemVer));
  });
  it("Return error when input is wrong", () => {
    const badSemVer = "1.11";
    const result = SemVer.decode(badSemVer);
    expect(E.isLeft(result)).toBe(true);
  });
  it("Return error when input is a number", () => {
    const badSemVer = 1.11;
    const result = SemVer.decode(badSemVer);
    expect(E.isLeft(result)).toBe(true);
  });
  it("Return error when input is a null", () => {
    const badSemVer = null;
    const result = SemVer.decode(badSemVer);
    expect(E.isLeft(result)).toBe(true);
  });
});