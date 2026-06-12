const fs = require("fs").promises;
const path = require('path');

const doLocal = process.env.IS_TEST === "true";
const LOCAL_FILE_PATH = path.join(__dirname, '../../.local/data/storage.json');
const STORAGE_API_URL = process.env.STORAGE_URL;
const STORAGE_API_KEY = process.env.STORAGE_API_KEY;

if (!STORAGE_API_KEY) {
  console.warn("Warning: STORAGE_API_KEY not set in environment");
}

// If Node < 18, uncomment:
// const fetch = require('node-fetch');


let storage = {}; // in-memory JSON object
let editing = Promise.resolve(); // serializes all edit/save operations

async function saveLocalStorageAsync() {
  await fs.writeFile(LOCAL_FILE_PATH, JSON.stringify(storage, null, 2), "utf-8");
}

async function loadLocalStorageAsync() {
  try {
    const content = await fs.readFile(LOCAL_FILE_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    return {}; // file missing or invalid → start empty
  }
}

// low-level patch to GitHub Gist (returns Promise)
async function _patchToGist() {
  const payload = {
    files: {
      "data.json": { content: JSON.stringify(storage, null, 2) },
    },
  };
  const res = await fetch(`${STORAGE_API_URL}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${STORAGE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Gist save failed: ${res.status} ${res.statusText} ${text}`
    );
  }
  return res.json();
}

// Load storage from gist (call at startup). Overwrites in-memory storage.
async function loadStorage() {
  if (doLocal)
  {
    storage = await loadLocalStorageAsync();
    return storage;
  }

  const res = await fetch(`${STORAGE_API_URL}`, {
    headers: { Authorization: `token ${STORAGE_API_KEY}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Failed to load gist: ${res.status} ${res.statusText} ${txt}`
    );
  }
  const gist = await res.json();
  // prefer file named data.json, else take the first file
  const file =
    gist.files && (gist.files["data.json"] || Object.values(gist.files)[0]);
  if (!file) {
    storage = {};
  } else {
    try {
      storage = JSON.parse(file.content);
    } catch (err) {
      // if parsing fails, start with empty object to avoid crashes
      console.error(
        "Failed to parse gist JSON, starting with empty object:",
        err
      );
      storage = {};
    }
  }
  return storage;
}

// Return the in-memory storage object (direct ref).
// Mutate synchronously only if you plan to call saveStorage() or modifyStorage().
/**  @returns {import("./storage_types").StorageType}*/
function getStorage() {
  return storage;
}

// modifyStorage(fn):
// - fn may be synchronous or async
// - runs exclusively (no two modifyStorage callbacks run concurrently)
// - after fn finishes, storage is persisted to gist
// - returns a promise that resolves when save completes (or rejects on error)
/** @param {(storage : import("./storage_types").StorageType) => Promise<void> | void} fn */
function modifyStorage(fn) {
  // chain the operation onto editing so everything is serialized
  const op = editing.then(async () => {
    // allow fn to read/modify storage; await if it returns a promise
    await fn(storage);
    // persist the updated storage
    // if (doLocal)
    //   await saveLocalStorageAsync();
    // else
    //   await _patchToGist();
    waitingToBeSaved = true;
  }).catch(err=> {
    console.log("Error modifying gist: ", err);
  });
  // keep the chain alive even if this op fails (but allow caller to see the error)
  editing = op.catch((e) => {
    // swallow here only to continue chain; caller still sees rejection from op
    console.error(
      "modifyStorage operation failed:",
      e && e.message ? e.message : e
    );
  });
  return op;
}

// saveStorage(): persist current storage to gist, but waits for any ongoing edits first.
// returns a promise resolving when saved.
let waitingToBeSaved = false;

function saveStorage(areYouSure = false) {
  if (!areYouSure) {
    waitingToBeSaved = true;
    return;
  }
  if (!storage || Object.keys(storage).length === 0) {
    console.error(
      "The storage is empty for some reason ! therefore save was not done"
    );
    return;
  }
  const op = editing.then(async () => {
    if (doLocal)
      await saveLocalStorageAsync();
    else
      await _patchToGist();
    waitingToBeSaved = false;
  });
  editing = op.catch((e) => {
    console.log("saveStorage failed:", e && e.message ? e.message : e);
  });
  return op;
}


async function gracefulExit(code = 0) {
  try {
    // console.log("Saving storage before exit...");
    // await saveStorage();
    // console.log("Saved. Exiting.");
  } catch (err) {
    console.error("Failed to save on exit:", err);
  } finally {
    process.exit(code);
  }
}
process.on("SIGINT", () => gracefulExit(0));
process.on("SIGTERM", () => gracefulExit(0));


module.exports = {
  waitingToBeSaved,
  loadStorage,
  getStorage,
  modifyStorage,
  saveStorage,
};