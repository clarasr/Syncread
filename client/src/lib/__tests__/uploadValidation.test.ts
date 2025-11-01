import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateUploadFile,
  getUploadStageProgress,
  getUploadStatusMessage,
} from "../uploadValidation";

describe("validateUploadFile", () => {
  const createFile = (name: string, size: number, type?: string) => ({
    name,
    size,
    type: type ?? "",
  }) as File;

  it("accepts valid epub files", () => {
    const result = validateUploadFile(createFile("title.epub", 1024), "epub");
    assert.equal(result.valid, true);
  });

  it("rejects files with missing extension", () => {
    const result = validateUploadFile(createFile("title", 1024), "epub");
    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /missing an extension/i);
  });

  it("rejects files that exceed size limits", () => {
    const result = validateUploadFile(createFile("title.epub", 200 * 1024 * 1024), "epub");
    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /maximum size/i);
  });

  it("rejects unexpected MIME types when provided", () => {
    const result = validateUploadFile(createFile("track.mp3", 1024, "application/json"), "audio");
    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /unexpected mime type/i);
  });
});

describe("upload stage helpers", () => {
  it("maps stages to progress values", () => {
    assert.equal(getUploadStageProgress("validating"), 10);
    assert.equal(getUploadStageProgress("uploading"), 45);
    assert.equal(getUploadStageProgress("processing"), 85);
    assert.equal(getUploadStageProgress("idle"), undefined);
  });

  it("provides status messages per stage", () => {
    assert.match(getUploadStatusMessage("uploading", "epub"), /uploading book/i);
    assert.match(getUploadStatusMessage("processing", "audio"), /analyzing audio/i);
  });
});
