import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/api";

export const MAX_UPLOAD = 5 * 1024 * 1024;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export function detectImageMime(buf: Uint8Array): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.subarray(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

const EXT: Record<ImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function uploadDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || "storage/uploads");
}

export async function validateImage(file: File): Promise<{ buf: Buffer; mime: ImageMime }> {
  if (file.size === 0) throw new ApiError(400, "Фото товара обязательно");
  if (file.size > MAX_UPLOAD) throw new ApiError(400, "Файл больше 5 МБ");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = detectImageMime(buf);
  if (!mime) throw new ApiError(400, "Допустимы только изображения JPEG, PNG или WebP");
  return { buf, mime };
}

export async function storeImage(buf: Buffer, mime: ImageMime): Promise<string> {
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(16).toString("hex")}.${EXT[mime]}`;
  await writeFile(path.join(dir, name), buf);
  return name;
}

export async function readStored(name: string): Promise<Buffer> {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(name)) throw new ApiError(404, "Файл не найден");
  return readFile(path.join(uploadDir(), name));
}

export async function deleteStored(name: string): Promise<void> {
  if (!/^[a-f0-9]{32}.(jpg|png|webp)$/.test(name)) return;
  await unlink(path.join(uploadDir(), name)).catch(() => {});
}
