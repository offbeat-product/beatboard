import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "manager" | "viewer";

export function useUserRole() {
  const [role, setRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("active");
  const [profileExists, setProfileExists] = useState(true);

  const fetchRole = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      // No profile found → treat as admin (initial user)
      setRole("admin");
      setProfileExists(false);
      setLoading(false);
      return;
    }

    setProfileExists(true);
    setStatus(data.status || "active");
    if (data.role) setRole(data.role as UserRole);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRole(); }, [fetchRole]);

  return {
    role,
    loading,
    status,
    profileExists,
    isAdmin: role === "admin",
    isViewer: role === "viewer",
    isDeleted: status === "deleted",
    refetch: fetchRole,
  };
}
