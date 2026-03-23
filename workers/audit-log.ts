import { randomUUID } from "crypto";

import {
  appendPersistedAuditEvent,
  listPersistedAuditEvents,
  resetPolicyRuntimeStoreForTests,
} from "@/lib/server/policy-runtime-store";
import type {
  ActorRole,
  AuditEvent,
  AuditEventType,
} from "@/lib/types/constitution";

export interface AuditLogWriter {
  append(event: AuditEvent): Promise<AuditEvent>;
  list(limit?: number): Promise<AuditEvent[]>;
  reset(): Promise<void>;
}

export class InMemoryAuditLogWriter implements AuditLogWriter {
  async append(event: AuditEvent): Promise<AuditEvent> {
    return appendPersistedAuditEvent(event);
  }

  async list(limit = 100): Promise<AuditEvent[]> {
    return listPersistedAuditEvents(limit);
  }

  async reset(): Promise<void> {
    resetPolicyRuntimeStoreForTests();
  }
}

export const inMemoryAuditLog = new InMemoryAuditLogWriter();

export async function appendAuditEvent(event: AuditEvent): Promise<AuditEvent> {
  return inMemoryAuditLog.append(event);
}

export async function listAuditEvents(limit?: number): Promise<AuditEvent[]> {
  return inMemoryAuditLog.list(limit);
}

export function createAuditEvent(args: {
  type: AuditEventType;
  actor: ActorRole;
  actionId?: string;
  atMs?: number;
  metadata?: Readonly<Record<string, unknown>>;
}): AuditEvent {
  return {
    id: randomUUID(),
    type: args.type,
    actor: args.actor,
    actionId: args.actionId,
    atMs: args.atMs ?? Date.now(),
    metadata: args.metadata,
  };
}
