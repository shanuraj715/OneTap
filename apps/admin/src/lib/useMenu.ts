import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { Outlet } from "./api";

export function useMenu(outlet: Outlet | undefined) {
  return useQuery({
    queryKey: ["menu", outlet?._id],
    queryFn: () => api.getMenu(outlet!),
    enabled: Boolean(outlet),
  });
}

/** All menu mutations invalidate the same key, so the editor always shows server truth. */
function useMenuMutation<TArgs>(
  outlet: Outlet | undefined,
  fn: (outlet: Outlet, args: TArgs) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(outlet!, args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu", outlet?._id] }),
  });
}

export const useCreateCategory = (o?: Outlet) =>
  useMenuMutation<api.CategoryInput>(o, (outlet, body) => api.createCategory(outlet, body));

export const useUpdateCategory = (o?: Outlet) =>
  useMenuMutation<{ id: string; body: Partial<api.CategoryInput> }>(o, (outlet, a) =>
    api.updateCategory(outlet, a.id, a.body),
  );

export const useDeleteCategory = (o?: Outlet) =>
  useMenuMutation<string>(o, (outlet, id) => api.deleteCategory(outlet, id));

export const useCreateItem = (o?: Outlet) =>
  useMenuMutation<api.ItemInput & { categoryId: string; name: string }>(o, (outlet, body) =>
    api.createItem(outlet, body),
  );

export const useUpdateItem = (o?: Outlet) =>
  useMenuMutation<{ id: string; body: api.ItemInput }>(o, (outlet, a) =>
    api.updateItem(outlet, a.id, a.body),
  );

export const useDeleteItem = (o?: Outlet) =>
  useMenuMutation<string>(o, (outlet, id) => api.deleteItem(outlet, id));

export const useCreateModifierGroup = (o?: Outlet) =>
  useMenuMutation<api.GroupInput & { name: string }>(o, (outlet, body) =>
    api.createModifierGroup(outlet, body),
  );

export const useDeleteModifierGroup = (o?: Outlet) =>
  useMenuMutation<string>(o, (outlet, id) => api.deleteModifierGroup(outlet, id));
