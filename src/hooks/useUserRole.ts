import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "manager" | "viewer";

export function useUserRole() {
  const [role, setRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (data?.role) setRole(data.role as UserRole);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRole(); }, [fetchRole]);

  return { role, loading, isAdmin: role === "admin", isViewer: role === "viewer" };
}
