import type { Context } from "grammy";

import type {
  FileMessage,
  Message,
  MessageScope,
  PhotoMessage,
  PollMessage,
  TextMessage,
  VoiceMessage,
} from "../repositories/message.repository";

export function dbMessageFromContext(ctx: Context): Message | null {
  const message = ctx.message;

  if (!message || !ctx.from) {
    return null;
  }

  const scope: MessageScope = {
    chatId: message.chat.id,
    threadId: message.is_topic_message
      ? message.message_thread_id ?? null
      : null,
  };

  const base = {
    ...scope,
    messageId: message.message_id,
    senderId: ctx.from.id,
    sentAt: new Date(message.date * 1000),
    storedAt: new Date(),
  };

  if ("text" in message) {
    const result: TextMessage = {
      ...base,
      type: "text",
      text: message.text ?? '',
    };

    return result;
  }

  if ("poll" in message) {
    const result: PollMessage = {
      ...base,
      type: "poll",
      pollId: message.poll?.id ?? '',
      question: message.poll?.question ?? '',
      options: message.poll?.options.map((option) => ({
        text: option.text,
        voterCount: option.voter_count,
      })) ?? [],
    };

    return result;
  }

  if ("document" in message) {
    const document = message.document;

    const result: FileMessage = {
      ...base,
      type: "file",
      fileId: document!.file_id,
      fileName: document!.file_name,
      mimeType: document!.mime_type,
      fileSize: document!.file_size,
      caption: message.caption,
    };

    return result;
  }

  if ("photo" in message) {
    const photo = message?.photo?.at(-1);

    if (!photo) {
      return null;
    }

    const result: PhotoMessage = {
      ...base,
      type: "photo",
      fileId: photo.file_id,
      width: photo.width,
      height: photo.height,
      caption: message.caption,
    };

    return result;
  }

  if ("voice" in message) {
    const voice = message.voice;

    if (!voice){
      return null;
    }

    const result: VoiceMessage = {
      ...base,
      type: "voice",
      fileId: voice.file_id,
      duration: voice.duration,
      mimeType: voice.mime_type,
      fileSize: voice.file_size,
    };

    return result;
  }

  return null;
}