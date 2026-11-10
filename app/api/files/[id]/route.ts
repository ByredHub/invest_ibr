import { apiRequireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, handle } from "@/lib/api";
import { readStored } from "@/lib/files";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await apiRequireUser();
    const { id } = await ctx.params;
    const file = await db.fileUpload.findUnique({ where: { id } });
    if (!file || (user.role !== "ADMIN" && file.ownerId !== user.id)) throw new ApiError(404, "Файл не найден");
    const buf = await readStored(file.storedAs);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  });
}
