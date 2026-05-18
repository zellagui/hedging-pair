const DB_NAME = "propfirm-trade-log-workspace-v1";
const DB_VERSION = 1;
const STORE = "handles";
/** Single stored handle at this key. */
const KEY_DIRECTORY = "journalDirectory";

type FsPermissionMode = "read" | "readwrite";

type DirectoryHandleWithPerm = FileSystemDirectoryHandle & {
  queryPermission(descriptor?: {
    mode?: FsPermissionMode;
  }): Promise<PermissionState>;
  requestPermission(descriptor?: {
    mode?: FsPermissionMode;
  }): Promise<PermissionState>;
};

export function supportsWorkspaceDirectoryPicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}

export async function pickWorkspaceDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsWorkspaceDirectoryPicker()) return null;
  try {
    return await (
      window as unknown as {
        showDirectoryPicker: (opts?: {
          mode?: string;
          startIn?: string;
        }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker({ mode: "readwrite", startIn: "documents" });
  } catch {
    return null;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function saveWorkspaceDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(handle, KEY_DIRECTORY);
  });
  db.close();
}

export async function getStoredWorkspaceDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  const handle = await new Promise<FileSystemDirectoryHandle | null>(
    (resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore(STORE).get(KEY_DIRECTORY);
      req.onsuccess = () =>
        resolve(
          req.result !== undefined &&
            typeof (req.result as unknown as FileSystemDirectoryHandle).getDirectoryHandle === "function"
            ? (req.result as FileSystemDirectoryHandle)
            : null
        );
    }
  );
  db.close();
  return handle;
}

export async function clearStoredWorkspaceDirectoryHandle(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(KEY_DIRECTORY);
  });
  db.close();
}

export async function ensureDirectoryHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: FsPermissionMode = "readwrite"
): Promise<PermissionState | "unsupported"> {
  const fh = handle as DirectoryHandleWithPerm;
  try {
    let q = await fh.queryPermission({ mode });
    if (q === "prompt") q = await fh.requestPermission({ mode });
    return q;
  } catch {
    try {
      return await fh.queryPermission({ mode });
    } catch {
      return "unsupported";
    }
  }
}
