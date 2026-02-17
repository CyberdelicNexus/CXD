import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";

// Check if a Supabase error indicates the table/column doesn't exist
function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    (error.message || "").includes("schema cache") ||
    (error.message || "").includes("does not exist")
  );
}

// GET - Load active thread or list archived sessions
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const faceKey = searchParams.get("faceKey");
    const history = searchParams.get("history");
    const allFaces = searchParams.get("allFaces");

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required param: projectId" },
        { status: 400 },
      );
    }

    // If history=true, return archived sessions
    if (history === "true") {
      let query = supabase
        .from("ai_chat_threads")
        .select("id, title, face_key, face_label, face_hue, is_active, is_archived, created_at, updated_at, messages")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .eq("is_archived", true)
        .order("updated_at", { ascending: false });

      // Filter by face unless allFaces=true
      if (allFaces !== "true" && faceKey) {
        query = query.eq("face_key", faceKey);
      }

      const { data, error } = await query;

      if (error) {
        if (isTableMissing(error)) {
          console.warn("[AI Threads] Table not found — returning empty. Run migrations to fix.");
          return NextResponse.json({ sessions: [] });
        }
        console.error("[AI Threads History Error]", error);
        return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
      }

      // Return sessions with message count (avoid sending full messages in list)
      const sessions = (data || []).map((t) => {
        const msgs = typeof t.messages === "string" ? JSON.parse(t.messages) : t.messages;
        return {
          id: t.id,
          title: t.title || generateTitle(msgs),
          faceKey: t.face_key,
          faceLabel: t.face_label || null,
          faceHue: t.face_hue ?? null,
          messageCount: Array.isArray(msgs) ? msgs.length : 0,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        };
      });

      return NextResponse.json({ sessions });
    }

    // Default: load the active thread for this face
    if (!faceKey) {
      return NextResponse.json(
        { error: "Missing required param: faceKey" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("ai_chat_threads")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("face_key", faceKey)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      if (isTableMissing(error)) {
        console.warn("[AI Threads] Table not found — returning null thread. Run migrations to fix.");
        return NextResponse.json({ thread: null });
      }
      console.error("[AI Threads GET Error]", error);
      return NextResponse.json({ error: "Failed to load thread" }, { status: 500 });
    }

    return NextResponse.json({ thread: data });
  } catch (error) {
    console.error("[AI Threads GET Error]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH - Get a specific archived thread by ID
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { threadId } = body as { threadId: string };

    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ai_chat_threads")
      .select("*")
      .eq("id", threadId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json({ thread: null });
      }
      console.error("[AI Thread Fetch Error]", error);
      return NextResponse.json({ error: "Failed to load thread" }, { status: 500 });
    }

    return NextResponse.json({ thread: data });
  } catch (error) {
    console.error("[AI Thread Fetch Error]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PUT - Save/update the active thread (upsert) or create new session
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, faceKey, messages, newSession, faceLabel, faceHue } = body as {
      projectId: string;
      faceKey: string;
      messages: unknown[];
      newSession?: boolean;
      faceLabel?: string;
      faceHue?: number;
    };

    if (!projectId || !faceKey) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, faceKey" },
        { status: 400 },
      );
    }

    // If newSession=true, archive the current active thread and create a new one
    if (newSession) {
      // Archive current active thread
      const { data: existing, error: findError } = await supabase
        .from("ai_chat_threads")
        .select("id, messages, face_label, face_hue")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .eq("face_key", faceKey)
        .eq("is_active", true)
        .maybeSingle();

      if (findError && isTableMissing(findError)) {
        console.warn("[AI Threads] Table not found — skipping save. Run migrations to fix.");
        return NextResponse.json({ thread: null });
      }

      if (existing) {
        const msgs = typeof existing.messages === "string"
          ? JSON.parse(existing.messages)
          : existing.messages;

        // Only archive if it has messages
        if (Array.isArray(msgs) && msgs.length > 0) {
          await supabase
            .from("ai_chat_threads")
            .update({
              is_active: false,
              is_archived: true,
              title: generateTitle(msgs),
              // Backfill face metadata if missing
              face_label: existing.face_label || faceLabel || null,
              face_hue: existing.face_hue ?? faceHue ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          // Empty thread — just delete it instead of archiving
          await supabase
            .from("ai_chat_threads")
            .delete()
            .eq("id", existing.id);
        }
      }

      // Create fresh active thread
      const { data: newThread, error: insertError } = await supabase
        .from("ai_chat_threads")
        .insert({
          project_id: projectId,
          user_id: user.id,
          face_key: faceKey,
          face_label: faceLabel || null,
          face_hue: faceHue ?? null,
          messages: JSON.stringify([]),
          is_active: true,
          is_archived: false,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        if (isTableMissing(insertError)) {
          return NextResponse.json({ thread: null });
        }
        console.error("[AI Threads New Session Error]", insertError);
        return NextResponse.json({ error: "Failed to create new session" }, { status: 500 });
      }

      return NextResponse.json({ thread: newThread });
    }

    // Default: upsert messages to the active thread
    if (!messages) {
      return NextResponse.json(
        { error: "Missing required field: messages" },
        { status: 400 },
      );
    }

    // Try to find and update the existing active thread
    const { data: existing, error: findError } = await supabase
      .from("ai_chat_threads")
      .select("id, face_label, face_hue")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("face_key", faceKey)
      .eq("is_active", true)
      .maybeSingle();

    if (findError && isTableMissing(findError)) {
      console.warn("[AI Threads] Table not found — skipping save. Run migrations to fix.");
      return NextResponse.json({ thread: null });
    }

    if (existing) {
      // Build update payload — backfill face metadata if missing
      const updatePayload: Record<string, unknown> = {
        messages: JSON.stringify(messages),
        updated_at: new Date().toISOString(),
      };
      if (!existing.face_label && faceLabel) updatePayload.face_label = faceLabel;
      if (existing.face_hue == null && faceHue != null) updatePayload.face_hue = faceHue;

      const { data, error } = await supabase
        .from("ai_chat_threads")
        .update(updatePayload)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        if (isTableMissing(error)) {
          return NextResponse.json({ thread: null });
        }
        console.error("[AI Threads PUT Error]", error);
        return NextResponse.json({ error: "Failed to save thread" }, { status: 500 });
      }

      return NextResponse.json({ thread: data });
    }

    // No active thread exists yet - create one
    const { data, error } = await supabase
      .from("ai_chat_threads")
      .insert({
        project_id: projectId,
        user_id: user.id,
        face_key: faceKey,
        face_label: faceLabel || null,
        face_hue: faceHue ?? null,
        messages: JSON.stringify(messages),
        is_active: true,
        is_archived: false,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json({ thread: null });
      }
      console.error("[AI Threads PUT Error]", error);
      return NextResponse.json({ error: "Failed to save thread" }, { status: 500 });
    }

    return NextResponse.json({ thread: data });
  } catch (error) {
    console.error("[AI Threads PUT Error]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE - Remove an archived thread
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    const { error } = await supabase
      .from("ai_chat_threads")
      .delete()
      .eq("id", threadId)
      .eq("user_id", user.id);

    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json({ success: true });
      }
      console.error("[AI Threads DELETE Error]", error);
      return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AI Threads DELETE Error]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Generate a title from the first user message
function generateTitle(messages: unknown[]): string {
  if (!Array.isArray(messages) || messages.length === 0) return "Empty session";

  const firstUserMsg = messages.find(
    (m: unknown) => (m as { role: string }).role === "user",
  ) as { content?: string; parts?: { type: string; text: string }[] } | undefined;

  if (!firstUserMsg) return "Untitled session";

  // Handle both v6 parts format and plain content
  let text = firstUserMsg.content || "";
  if (!text && firstUserMsg.parts) {
    text = firstUserMsg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(" ");
  }

  if (!text) return "Untitled session";

  // Truncate to ~50 chars
  return text.length > 50 ? text.slice(0, 47) + "..." : text;
}
