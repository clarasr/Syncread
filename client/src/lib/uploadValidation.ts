const MAX_MB = 1024 * 1024;

type UploadKind = "epub" | "audio";

interface UploadRule {
  extensions: string[];
  mimeTypes: string[];
  maxSizeMb: number;
}

const RULES: Record<UploadKind, UploadRule> = {
  epub: {
    extensions: [".epub"],
    mimeTypes: ["application/epub+zip", "application/zip", "application/octet-stream"],
    maxSizeMb: 100,
  },
  audio: {
    extensions: [".mp3", ".m4a", ".m4b", ".wav"],
    mimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
    ],
    maxSizeMb: 500,
  },
};

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUploadFile(file: File, type: UploadKind): UploadValidationResult {
  const rule = RULES[type];
  const lastDot = file.name.lastIndexOf(".");
  if (lastDot === -1) {
    return {
      valid: false,
      error: "File is missing an extension.",
    };
  }

  const extension = file.name.substring(lastDot).toLowerCase();

  if (!rule.extensions.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported file type. Expected ${rule.extensions.join(", ")}`,
    };
  }

  if (file.size > rule.maxSizeMb * MAX_MB) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${rule.maxSizeMb}MB`,
    };
  }

  if (file.type && !rule.mimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Unexpected MIME type: ${file.type}`,
    };
  }

  return { valid: true };
}

export type UploadStage = "idle" | "validating" | "uploading" | "processing" | "complete";

const STAGE_PROGRESS: Record<UploadStage, number> = {
  idle: 0,
  validating: 10,
  uploading: 45,
  processing: 85,
  complete: 100,
};

export function getUploadStageProgress(stage: UploadStage | undefined): number | undefined {
  if (!stage || stage === "idle") {
    return undefined;
  }
  return STAGE_PROGRESS[stage];
}

export function getUploadStatusMessage(stage: UploadStage, type: UploadKind): string {
  switch (stage) {
    case "validating":
      return "Validating file";
    case "uploading":
      return type === "epub" ? "Uploading book" : "Uploading audio";
    case "processing":
      return type === "epub" ? "Preparing chapters" : "Analyzing audio";
    case "complete":
      return "Upload complete";
    default:
      return "";
  }
}

export function getUploadRules(type: UploadKind) {
  const rule = RULES[type];
  return {
    extensions: rule.extensions,
    maxSizeMb: rule.maxSizeMb,
  };
}
