const axios = require("axios");
const { getStorage, modifyStorage, saveStorage } = require("./storage");
const { isUndefined, min } = require("mathjs");
const { isCallChain } = require("typescript");
const throwError = require("./throwError");
const { docsTree } = require("../handlers/contibution_collector");
const { Api, InputFile, InputMediaBuilder } = require("grammy");
const fs = require("fs");
const { downloadFile } = require("./file_downloader");
const path = require("path");

/**
 * @param {string} locationStr
 * @returns {Promise<import("./gdrive_types").GDriveGetData>}
 */
async function getDriveContentFromWeb(locationStr, startFolder = null) {
  const response = await axios.get(process.env.SCRIPT_URL, {
    params: {
      from: "drive",
      startFolder: startFolder ?? getStorage().constants.driveId,
      location:
        locationStr === "" ? undefined : encodeURIComponent(locationStr),
    },
    timeout: 5 * 60 * 1000,
  });
  if (response.data.state !== "OK") {
    return null;
  }
  return response.data;
}

let currentParamsObject = undefined;

/**
 * @returns {Promise<import("./storage_types").DriveCacheFolder>}
 * @param {Array<string>} location
 * @param {Api} api
 */
async function getDriveContent(
  location,
  api,
  doAfterDownload,
  doAfterDownloadParams
) {
  /** @type {import("./storage_types").DriveCacheFolder} */
  let cache;
  let specifiedStartFolder = getStorage().constants.driveId;
  let specifiedLocation = location;
  let isCached = false;
  currentParamsObject = doAfterDownloadParams;
  if (location && location.length > 0 && location[0].startsWith("#")) {
    const folderIndex = location[0].substring(1);
    cache = getStorage().cache.folders[folderIndex];
    if (cache) {
      if (cache.toBeDownloaded) {
        isCached = false;
      } else {
        isCached = true;
      }
      specifiedStartFolder = cache.id;
      specifiedLocation = [];
    } else {
      return undefined;
    }
  } else {
    isCached = isFolderCached(getStorage().constants.driveId, location);
  }

  if (isCached) {
    cache =
      getStorage().cache.folders[
        getStorage().cache.folderIds[specifiedStartFolder]
      ];
    specifiedLocation.forEach((part) => {
      if (part == "") {
        return;
      }
      cache =
        cache.folders.find((fd) => areNamesEqual(fd.name, part)) ??
        cache.shortcuts.find((sh) => areNamesEqual(sh.name, part));
    });
    // download content in background
    fetchCache(api, specifiedStartFolder, specifiedLocation).then(
      async (data) => {
        console.log("updated \n", data);
        if (currentParamsObject === doAfterDownloadParams) {
          await doAfterDownload(data, doAfterDownloadParams);
        }
      }
    );
  } else {
    // download cache imediatly to be used after

    cache = await fetchCache(api, specifiedStartFolder, specifiedLocation);

    if (!cache) {
      return null;
    }

    cache.isFreshlyCached = true;

    await saveStorage();

    // await doAfterDownload(cache, doAfterDownloadParams);
  }

  return cache;
}

/**
 * @param {string} rawName1
 * @param {string} safeName2
 */
function areNamesEqual(rawName1, safeName2) {
  return (
    rawName1.trim().replaceAll(" ", "~").toLowerCase() ===
    safeName2.toLowerCase()
  );
}

/**
 * @param {string} startFolder
 * @param {Array<string>} location */
function isFolderCached(startFolder, location) {
  if (isUndefined(startFolder) || startFolder === "") {
    // console.log(startFolder);
    return false;
  }
  const cachedContentId = getStorage().cache.folderIds[startFolder];
  if (isUndefined(cachedContentId)) {
    // console.log("yeh something is wrong");
    return false;
  }
  const cachedContent = getStorage().cache.folders[cachedContentId];
  if (location.length > 0) {
    if (location[0] == "") {
      return true;
    }
    return (
      isFolderCached(
        cachedContent.folders.find((fd) => areNamesEqual(fd.name, location[0])),
        location.slice(1)
      ) ||
      isFolderCached(
        cachedContent.shortcuts.find((sh) =>
          areNamesEqual(sh.name, location[0])
        ),
        location.slice(1)
      )
    );
  }

  return true;
}

/** @param {Array<string>} location */
async function fetchCache(api, startFolder, location) {
  try {
    const result = await getDriveContentFromWeb(
      location.join(" "),
      startFolder
    );
    if (result) {
      await updateCache(api, result);
    }
    return result;
  } catch (ex) {
    throwError(ex);
  }
}

/**
 *
 * @param {import("./storage_types").StorageType} storage
 * @param {import("./storage_types").DriveCacheFolder} data
 * @param {number} folderId
 */
function getDisplayName(storage, parentId, subName) {
  let locationChain = [];
  locationChain.push(subName);
  let currentFolder = storage.cache.folders[parentId];
  while (parentId && currentFolder) {
    locationChain.push(currentFolder.name);
    parentId = currentFolder.parentId;
    currentFolder = storage.cache.folders[parentId];
  }
  // console.log("locationChain ", locationChain);
  let currentDisplayContent = docsTree;
  if (!docsTree || docsTree == {}) {
    console.log("wth?");
  }
  for (let l = locationChain.length - 2; l >= 0; l--) {
    // console.log("currentDisplayContent: ", currentDisplayContent);
    if (!currentDisplayContent) {
      return subName;
    }
    if (!currentDisplayContent.subFolders) {
      return subName;
    }
    currentDisplayContent = currentDisplayContent.subFolders.find((sF) => {
      // console.log("querry : %s sF: %s", locationChain[l], sF);
      try {
        if (!sF.folderName) {
          return subName;
        }
        if (!sF) {
          return subName;
        }
        return areNamesEqual(locationChain[l], sF.folderName);
      } catch {
        console.log("hawlik wjhel lkhra ", sF);
      }
    });
  }
  if (!currentDisplayContent) {
    return subName;
  }
  return currentDisplayContent.displayName || currentDisplayContent.name;
}

/**
 * @param {string} fIndex
 * @param {import("./storage_types").StorageType} storage
 * @param {import("./gdrive_types")._GDriveFile} info
 * @param {Api} api
 */
async function updateCacheFile(fIndex, storage, info, api) {
  // console.log("y?");
  const url = `https://drive.google.com/uc?export=download&id=${info.id}`;
  try {
    // const output = `.local/temp/${info.name}`;
    // console.log("caching file ", info.name);
    // await fs.promises.mkdir(path.dirname(output), { recursive: true });
    // await downloadFile(url, output);

    // console.log(`file ${info.name} was downloaded successfully.`);

    const msg = info.mimeType.startsWith("image")
      ? await api.sendPhoto(
          storage.constants.botgroup,
          new InputFile(new URL(url), info.name)
        )
      : await api.sendDocument(
          storage.constants.botgroup,
          new InputFile(new URL(url), info.name)
        );
    storage.documents.drive[fIndex] = msg.message_id;
    return true;
  } catch (ex) {
    throwError(ex);
    return false;
  }
}

/**
 * @param {string} fIndex
 * @param {import("./storage_types").StorageType} storage
 * @param {import("./storage_types").DriveCacheFolder} data
 * @param {Api} api
 */
async function updateCacheMediaGroup(fIndex, storage, data, api) {
  let photos = [];

  data.files.sort((a,b) => a.name.localeCompare(b.name));
  data.files.forEach((f) => {
    const url = `https://drive.google.com/uc?export=download&id=${f.id}`;
    photos.push(InputMediaBuilder.photo(url));
  });

  storage.documents.drive[fIndex] = [];

  let batchIndex = 0;
  do {
    const batchSize = min(photos.length - batchIndex, 10);
    (
      await api.sendMediaGroup(
        storage.constants.botgroup,
        photos.slice(batchIndex, batchIndex + batchSize)
      )
    ).forEach((ph) => {
      if (!storage.documents.drive[fIndex].includes(ph.message_id)) {
        storage.documents.drive[fIndex].push(ph.message_id);
      }
    });

    batchIndex += 10;
  } while (batchIndex < photos.length);
}

/**
 * @param {import("./gdrive_types").GDriveGetData} data
 * @param {Api} api
 */
async function updateCache(api, data) {
  await modifyStorage(async (storage) => {
    let id = storage.cache.folderIds[data.id];
    if (isUndefined(id)) {
      id = storage.cache.foldersIdCounter++;
      storage.cache.folderIds[data.id] = id;
    }

    const previousData = storage.cache.folders[id];

    let mediaGroupHasToBeUpdated = false;

    if (
      (data.folders && data.folders.length > 0) ||
      (data.shortcuts && data.shortcuts.length > 0)
    ) {
      data.isMediaGroup = false;
    } else if (data.isMediaGroup) {
      mediaGroupHasToBeUpdated = storage.cache.filesIndices[data.id]
        ? false
        : true;
    }

    if (data.isMediaGroups) console.log("isMediaGroup");

    // cache files if needed
    for (let f = 0; f < data.files.length; f++) {
      const fId = data.files[f].id;
      let fIndex = storage.cache.filesIndices[fId];
      let fileHasToBeUpdated = false;
      if (isUndefined(fIndex) || !previousData || !previousData.files) {
        fileHasToBeUpdated = true;
      } else {
        const previousFileData = previousData.files.find((pF) => pF.id === fId);
        if (
          !previousFileData ||
          previousFileData.lastModify !== data.files[f].lastModify
        ) {
          fileHasToBeUpdated = true;
        }
      }

      if (fileHasToBeUpdated) {
        if (data.isMediaGroup) {
          mediaGroupHasToBeUpdated = true;
        } else {
          if (isUndefined(fIndex)) {
            fIndex = storage.cache.filesIndexCounter++;
            storage.cache.filesIndices[fId] = fIndex;
          }
          await updateCacheFile(fIndex, storage, data.files[f], api);
        }
      }
    }

    if (mediaGroupHasToBeUpdated) {
      let fIndex = storage.cache.filesIndices[data.id];
      if (isUndefined(fIndex)) {
        fIndex = storage.cache.filesIndexCounter++;
        storage.cache.filesIndices[data.id] = fIndex;
      }

      await updateCacheMediaGroup(fIndex, storage, data, api);
    }

    storage.cache.folders[id] = {
      ...(storage.cache.folders[id] || {}),
      toBeDownloaded: undefined,
      name: data.name,
      id: data.id,
      isMediaGroup: data.isMediaGroup || undefined,
      folders: data.folders,
      shortcuts: data.shortcuts,
      files: data.files,
    };

    for (let fd = 0; fd < data.folders.length; fd++) {
      const fdId = data.folders[fd].id;
      const displayName = getDisplayName(storage, id, data.folders[fd].name);
      if (isUndefined(storage.cache.folderIds[fdId])) {
        storage.cache.folderIds[fdId] = storage.cache.foldersIdCounter++;
        storage.cache.folders[storage.cache.folderIds[fdId]] = {
          id: fdId,
          parentId: id,
          name: data.folders[fd].name,
          displayName: displayName,
          toBeDownloaded: true,
        };
      }
      const cacheFolder = storage.cache.folders[storage.cache.folderIds[fdId]];
      if (cacheFolder) {
        cacheFolder.displayName = displayName;
      }
    }
    for (let sh = 0; sh < data.shortcuts.length; sh++) {
      const shId = data.shortcuts[sh].id;
      const displayName = getDisplayName(storage, id, data.shortcuts[sh].name);
      if (isUndefined(storage.cache.folderIds[shId])) {
        storage.cache.folderIds[shId] = storage.cache.foldersIdCounter++;
        storage.cache.folders[storage.cache.folderIds[shId]] = {
          id: shId,
          name: data.shortcuts[sh].name,
          parentId: id,
          displayName: displayName,
          toBeDownloaded: true,
        };
      }
      const cacheFolder = storage.cache.folders[storage.cache.folderIds[shId]];
      if (cacheFolder) {
        cacheFolder.displayName = displayName;
      }
    }
  });
}

module.exports = { fetchCache, getDriveContent, areNamesEqual };
