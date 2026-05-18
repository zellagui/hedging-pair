import {
  CSV_FILE_CHALLENGES,
  CSV_FILE_IDENTITIES,
  CSV_FILE_META,
  CSV_FILE_PAIRS,
  CSV_FILE_SESSIONS,
  CSV_FILE_TRADES,
} from "./csv-io";

const WORKSPACE_FILENAMES = [
  CSV_FILE_META,
  CSV_FILE_IDENTITIES,
  CSV_FILE_CHALLENGES,
  CSV_FILE_TRADES,
  CSV_FILE_PAIRS,
  CSV_FILE_SESSIONS,
] as const;

export async function readTradeLogCsvFilesFromDirectory(
  root: FileSystemDirectoryHandle,
  subdirectory?: string
): Promise<Record<string, string>> {
  let dir = root;
  if (subdirectory?.trim()) {
    dir = await root.getDirectoryHandle(subdirectory.trim(), { create: false });
  }

  const out: Record<string, string> = {};
  for (const name of WORKSPACE_FILENAMES) {
    try {
      const fh = await dir.getFileHandle(name);
      const file = await fh.getFile();
      out[name] = await file.text();
    } catch {
      /* file may be missing */
    }
  }
  return out;
}

export async function writeTradeLogCsvFilesToDirectory(
  root: FileSystemDirectoryHandle,
  files: Record<string, string>,
  subdirectory?: string
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  if (subdirectory?.trim()) {
    dir = await root.getDirectoryHandle(subdirectory.trim(), { create: true });
  }

  for (const name of WORKSPACE_FILENAMES) {
    const content = files[name];
    if (content === undefined) continue;
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(content);
    await w.close();
  }
  return dir;
}
