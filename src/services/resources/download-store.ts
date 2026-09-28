import { Bot, InputFile } from "grammy";
import { resourcesBot } from "../../lib/bots/index.js";
import {
  Resource,
  resourceFiles,
  ResourceInput,
  resources,
} from "../../repositories/resource.repository.js";
import { generateTimestampId } from "../../utils/genid.js";

export async function downloadDocumentAndStoreResource(
  resourceFileDownloadUrl: string,
  storageOptions: {
    fileName: string;
    chatId: number;
    threadId: number | null;
    previewFile?: InputFile;
  },
  resourceOther?: ResourceInput,
  customBot?:Bot,
): Promise<Resource> {
  const docMessage = await (customBot??resourcesBot).api.sendDocument(
    storageOptions.chatId,
    new InputFile(new URL(resourceFileDownloadUrl), storageOptions.fileName),
    {
      thumbnail: storageOptions.previewFile,
      message_thread_id: storageOptions.threadId ?? undefined,
    },
  );

  const resource = await resources.createResource({
    isApproved: true,
    isMediaGroup: false,
    type: "UNDEFINED",
    ...resourceOther,
    name: resourceOther?.name ?? `res_undefined_${generateTimestampId()}`,
    displayName: storageOptions.fileName,
    telegramStoredChatId: storageOptions.chatId,
    telegramStoredThreadId: storageOptions.threadId,
  });

  resourceFiles.addResourceFile({
    resourceId: resource._id,
    fileId: docMessage.document.file_id,
    fileName: docMessage.document.file_name ?? "unknown",
    mimeType: docMessage.document.mime_type ?? "application/octet-stream",
    telegramStoredMessageId: docMessage.message_id,
  });

  return resource;
}
