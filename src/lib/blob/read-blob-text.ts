import { get } from "@vercel/blob";

/** Read blob body as text, or null if missing. */
export async function readBlobJsonText(
  pathname: string
): Promise<string | null> {
  try {
    const result = await get(pathname, { access: "public" });
    if (result == null || result.statusCode === 304) {
      return null;
    }
    return await new Response(result.stream).text();
  } catch {
    return null;
  }
}
