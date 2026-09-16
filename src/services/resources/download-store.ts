import { InputFile } from "grammy";
import { resourcesBot } from "../../lib/bots";
import {
  Resource,
  resourceFiles,
  ResourceInput,
  resources,
} from "../../repositories/resource.repository";
import { generateTimestampId } from "../../utils/genid";

export async function downloadDocumentAndStoreResource(
  resourceFileDownloadUrl: string,
  storageOptions: {
    fileName: string;
    chatId: number;
    threadId: number | null;
    previewUrl?: string;
  },
  resourceOther?: ResourceInput,
): Promise<Resource> {
  const docMessage = await resourcesBot.api.sendDocument(
    storageOptions.chatId,
    new InputFile(new URL(resourceFileDownloadUrl), storageOptions.fileName),
    {
      thumbnail: storageOptions.previewUrl
        ? new InputFile(new URL(storageOptions.previewUrl))
        : undefined,
      message_thread_id: storageOptions.threadId ?? undefined,
    },
  );

  const resource = await resources.createResource({
    isApproved: true,
    isMediaGroup: false,
    type: "UNDEFINED",
    ...resourceOther,
    name: resourceOther?.name ?? `res_undefined_${generateTimestampId()}`,
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
