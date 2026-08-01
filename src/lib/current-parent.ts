import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/authOtp";

export interface ParentProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
}

export interface ParentChild {
  id: string;
  full_name: string;
  class_id: string | null;
  className: string | null;
  school_id: string;
  schoolName: string;
  schoolPhone: string | null;
}

export interface CurrentParent {
  authId: string;
  parent: ParentProfile;
  children: ParentChild[];
}

/**
 * Loads the signed-in parent's profile and linked children. Redirects to
 * /parent/login if there is no session, and to /login if this account is
 * actually a staff account (someone hit /parent by mistake).
 */
export async function requireParent(): Promise<CurrentParent> {
  const supabase = await createClient();
  const userResult = await withAuthTimeout(supabase.auth.getUser(), 8000);
  const user = "data" in userResult ? userResult.data.user : null;

  if (!user) {
    redirect("/parent/login");
  }

  const { data: parent } = await supabase
    .from("parents")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!parent) {
    redirect("/login");
  }

  // Sync any newly-registered children whose parent_email now matches.
  await supabase.rpc("link_my_children");

  const { data: links } = await supabase
    .from("parent_students")
    .select("student_id, students(id, full_name, class_id, school_id, classes(name), schools(name, status, phone))")
    .eq("parent_id", user.id);

  const children: ParentChild[] = (links ?? [])
    .map((link) => {
      const student = link.students as unknown as {
        id: string;
        full_name: string;
        class_id: string | null;
        school_id: string;
        classes: { name: string } | null;
        schools: { name: string; status: string; phone: string | null } | null;
      } | null;
      if (!student || student.schools?.status === "suspended") return null;
      return {
        id: student.id,
        full_name: student.full_name,
        class_id: student.class_id,
        className: student.classes?.name ?? null,
        school_id: student.school_id,
        schoolName: student.schools?.name ?? "",
        schoolPhone: student.schools?.phone ?? null,
      };
    })
    .filter((c): c is ParentChild => c !== null);

  return { authId: user.id, parent: parent as ParentProfile, children };
}
