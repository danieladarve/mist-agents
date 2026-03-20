import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, setLogLevel } from "../../src/utils/logger.js";

describe("logger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    setLogLevel("debug");
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    setLogLevel("info");
  });

  it("logs debug messages when level is debug", () => {
    logger.debug("test debug");
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0]?.[0]).toContain("[DEBUG]");
    expect(stderrSpy.mock.calls[0]?.[0]).toContain("test debug");
  });

  it("logs info messages", () => {
    logger.info("test info");
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0]?.[0]).toContain("[INFO]");
  });

  it("logs warn messages", () => {
    logger.warn("test warn");
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0]?.[0]).toContain("[WARN]");
  });

  it("logs error messages", () => {
    logger.error("test error");
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0]?.[0]).toContain("[ERROR]");
  });

  it("suppresses debug when level is info", () => {
    setLogLevel("info");
    logger.debug("should not appear");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("suppresses info when level is warn", () => {
    setLogLevel("warn");
    logger.info("should not appear");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("suppresses warn when level is error", () => {
    setLogLevel("error");
    logger.warn("should not appear");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("includes timestamp in output", () => {
    logger.info("timestamp test");
    const output = stderrSpy.mock.calls[0]?.[0] as string;
    expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
  });
});
