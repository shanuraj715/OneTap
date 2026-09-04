import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
                                                                     
import * as api from "./api";
import { ApiError } from "./api";

/** Current session. A 401 means "not signed in", not an error to surface. */
export function useAuth() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return (await api.me()).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const user = (query.data ?? null)                      ;
  return {
    user,
    isLoading: query.isLoading,
    error: query.error                ,
    can: (p            ) => Boolean(user?.permissions.includes(p)),
  };
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v                                     ) => api.login(v.email, v.password),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.setQueryData(["me"], null);
      qc.invalidateQueries();
    },
  });
}

/* ---------------------------------------------------------------------- users */

export function useUsers(enabled         ) {
  return useQuery({ queryKey: ["users"], queryFn: api.listUsers, enabled });
}

function useUserMutation       (fn                                   ) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }) });
}

export const useCreateUser = () => useUserMutation(api.createUser);
export const useUpdateUser = () =>
  useUserMutation((a                                                            ) => api.updateUser(a.id, a.body));
export const useDeleteUser = () => useUserMutation(api.deleteUser);
