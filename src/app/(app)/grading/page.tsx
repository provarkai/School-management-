import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ComponentsManager, type Component } from "./ComponentsManager";
import { GradeBandsManager, type GradeBand } from "./GradeBandsManager";
import { TraitsManager, type Trait } from "./TraitsManager";

export default async function GradingPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const [{ data: components }, { data: bands }, { data: traits }] = await Promise.all([
    supabase
      .from("assessment_components")
      .select("id, name, kind, max_score")
      .eq("school_id", profile.school_id ?? "")
      .order("position"),
    supabase
      .from("grade_bands")
      .select("id, letter, min_score")
      .eq("school_id", profile.school_id ?? "")
      .order("min_score", { ascending: false }),
    supabase
      .from("report_card_traits")
      .select("id, name, domain")
      .eq("school_id", profile.school_id ?? "")
      .order("position"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Grading</h1>
        <p className="text-sm text-zinc-500">
          How scores are broken down and turned into grades. Changing these affects every
          report card from here on — existing scores keep the grade they were awarded until
          they&rsquo;re next edited.
        </p>
      </div>

      <ComponentsManager components={(components ?? []) as Component[]} />
      <GradeBandsManager bands={(bands ?? []) as GradeBand[]} />
      <TraitsManager traits={(traits ?? []) as Trait[]} />
    </div>
  );
}
