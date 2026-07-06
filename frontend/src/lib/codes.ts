import { createClient } from "@/lib/supabase/client";
import { generateCode } from "@/lib/utils";

export async function nextCode(
  table: string,
  companyId: string,
  prefix: string
): Promise<string> {
  const supabase = createClient();
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return generateCode(prefix, count ?? 0);
}
