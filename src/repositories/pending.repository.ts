import { ObjectId } from "mongodb";
import { db } from "../lib/mongodb.js";

export type PendingType = "SHARED_RESOURCE";

export type PendingStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface PendingRequest {
  _id: ObjectId;

  type: PendingType;

  ownerId?: number;

  comment?: string;

  status: PendingStatus;

  /**
   * Telegram location of the request/approval message.
   */
  requestChatId: number;
  requestMessageId: number;
  requestThreadId?: number;

  /**
   * Resource created when the request is approved.
   */
  resourceId?: ObjectId;

  /**
   * User who reviewed the request.
   */
  reviewedBy?: number;

  rejectionReason?: string;

  createdAt: Date;
  reviewedAt?: Date;
}

export type PendingRequestInput = Omit<
  PendingRequest,
  "_id" | "createdAt" | "status"
>;

const pendingRequestsCollection =
  db.collection<PendingRequest>("pending_requests");

async function createPendingRequest(
  input: PendingRequestInput
): Promise<PendingRequest> {
  const request: PendingRequest = {
    _id: new ObjectId(),
    ...input,
    status: "PENDING",
    createdAt: new Date(),
  };

  await pendingRequestsCollection.insertOne(request);

  return request;
}

async function findPendingRequestById(
id: ObjectId
): Promise<PendingRequest | null> {
  return pendingRequestsCollection.findOne({
    _id: id,
  });
}

async function findPendingRequests(): Promise<PendingRequest[]> {
  return pendingRequestsCollection
    .find({
      status: "PENDING",
    })
    .sort({ createdAt: 1 })
    .toArray();
}

async function findPendingRequestsByOwner(
  ownerId: number
): Promise<PendingRequest[]> {
  return pendingRequestsCollection
    .find({
      ownerId,
    })
    .sort({ createdAt: -1 })
    .toArray();
}

async function findPendingRequestsByType(
  type: PendingType
): Promise<PendingRequest[]> {
  return pendingRequestsCollection
    .find({
      type,
    })
    .sort({ createdAt: 1 })
    .toArray();
}

async function approvePendingRequest(
  id: ObjectId,
  reviewerId: number,
  resourceId: ObjectId
): Promise<PendingRequest | null> {
  const result = await pendingRequestsCollection.findOneAndUpdate(
    {
      _id: id,
      status: "PENDING",
    },
    {
      $set: {
        status: "APPROVED",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        resourceId,
      },
    },
    {
      returnDocument: "after",
    }
  );

  return result;
}

async function rejectPendingRequest(
  id: ObjectId,
  reviewerId: number,
  rejectionReason?: string
): Promise<PendingRequest | null> {
  const result = await pendingRequestsCollection.findOneAndUpdate(
    {
      _id: id,
      status: "PENDING",
    },
    {
      $set: {
        status: "REJECTED",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason,
      },
    },
    {
      returnDocument: "after",
    }
  );

  return result;
}

async function deletePendingRequest(
  id: ObjectId
): Promise<boolean> {
  const result = await pendingRequestsCollection.deleteOne({
    _id: id,
  });

  return result.deletedCount === 1;
}

async function findPendingRequestByTelegramMessage(
  requestChatId: number,
  requestMessageId: number,
  requestThreadId?: number
): Promise<PendingRequest | null> {
  return pendingRequestsCollection.findOne({
    requestChatId,
    requestMessageId,
    ...(requestThreadId !== undefined
      ? { requestThreadId }
      : {}),
  });
}


export const pendings = {
  createPendingRequest,
  findPendingRequestById,
  findPendingRequests,
  findPendingRequestsByOwner,
  findPendingRequestsByType,
  approvePendingRequest,
  rejectPendingRequest,
  deletePendingRequest,
  findPendingRequestByTelegramMessage,
};