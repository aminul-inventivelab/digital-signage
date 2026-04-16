import type { MediaFileType } from "@signage/types";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export function inferMediaFileType(mime: string): MediaFileType {
  if (IMAGE_TYPES.has(mime)) return "image";
  if (VIDEO_TYPES.has(mime)) return "video";
  return "unknown";
}

export function isAcceptedSignageMime(mime: string): boolean {
  return inferMediaFileType(mime) !== "unknown";
}
