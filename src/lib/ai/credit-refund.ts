// Hands an AI credit charge back when the request it paid for failed.
//
// Routes deduct before the model runs, so without this a provider error, a
// timeout or a cut-off answer charged the user for nothing. Server-only: the
// refund function is granted to the service role alone (a refund a signed-in
// user could call on themselves would be free credits).

import { getSupabaseAdmin } from "@/supabase/admin";

/** Best-effort: a refund that cannot be made is logged, never thrown. */
export async function refundAICredits(userId: string, cost: number, route: string): Promise<void> {
  if (!userId || !(cost > 0)) return;
  try {
    // Throws when the service role key is missing; caught below like any other failure.
    const admin = getSupabaseAdmin();
    const { error } = await admin.rpc("refund_ai_credits", { p_user_id: userId, p_cost: cost });
    if (error) console.warn(`[${route}] credit refund failed: ${error.message}`);
  } catch (e) {
    console.warn(`[${route}] credit refund failed:`, e);
  }
}
