import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import { recordEvent } from "@/lib/engine/evidence-collector";
import type { RequirementNode, FunnelLayer } from "@/lib/utils/types";

export function upsertRequirementNode(attrs: {
  id?: string;
  session_id: string;
  layer: FunnelLayer;
  label: string;
  content: string;
  parent_id?: string | null;
  sort_order?: number;
}): RequirementNode {
  const db = getDb();
  const now = new Date().toISOString();

  // Upsert: if same session + layer exists, update it
  const existing = db.prepare(
    "SELECT id FROM requirement_nodes WHERE session_id = ? AND layer = ? AND label = ?"
  ).get(attrs.session_id, attrs.layer, attrs.label) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE requirement_nodes SET content = ?, updated_at = ? WHERE id = ?`
    ).run(attrs.content, now, existing.id);
    return db.prepare("SELECT * FROM requirement_nodes WHERE id = ?").get(existing.id) as RequirementNode;
  }

  const node: RequirementNode = {
    id: attrs.id || uuid(),
    session_id: attrs.session_id,
    layer: attrs.layer,
    label: attrs.label,
    content: attrs.content,
    parent_id: attrs.parent_id || null,
    sort_order: attrs.sort_order || 0,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO requirement_nodes (id, session_id, layer, label, content, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(node.id, node.session_id, node.layer, node.label, node.content, node.parent_id, node.sort_order, node.created_at, node.updated_at);

  // Record clarification evidence on successful creation (run() throws on failure)
  recordEvent("clarification", "requirement_created", "requirement_nodes", node.id);

  return node;
}

export function getRequirementNodes(sessionId: string): RequirementNode[] {
  const db = getDb();
  return db.prepare("SELECT * FROM requirement_nodes WHERE session_id = ? ORDER BY layer, sort_order").all(sessionId) as RequirementNode[];
}

export function deleteRequirementNode(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM requirement_nodes WHERE id = ?").run(id);
}
