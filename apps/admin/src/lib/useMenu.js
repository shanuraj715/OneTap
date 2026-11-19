import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { planCategoryMove } from "@onetap/config-schema";
import * as api from "./api";
                                    

export function useMenu(outlet                    ) {
  return useQuery({
    queryKey: ["menu", outlet?._id],
    queryFn: () => api.getMenu(outlet ),
    enabled: Boolean(outlet),
  });
}

/** All menu mutations invalidate the same key, so the editor always shows server truth. */
function useMenuMutation       (
  outlet                    ,
  fn                                                   ,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args       ) => fn(outlet , args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu", outlet?._id] }),
  });
}

export const useCreateCategory = (o         ) =>
  useMenuMutation                   (o, (outlet, body) => api.createCategory(outlet, body));

export const useUpdateCategory = (o         ) =>
  useMenuMutation                                                  (o, (outlet, a) =>
    api.updateCategory(outlet, a.id, a.body),
  );

export const useDeleteCategory = (o         ) =>
  useMenuMutation        (o, (outlet, id) => api.deleteCategory(outlet, id));

export const useCreateCategories = (o         ) =>
  useMenuMutation(o, (outlet, body) => api.createCategories(outlet, body));

export const useDeleteCategories = (o         ) =>
  useMenuMutation(o, (outlet, body) => api.deleteCategories(outlet, body));

/**
 * Drag-and-drop move. The tree changes the instant you let go (using the same rule the server applies) and is put
 * right again if the server says no.
 */
export function useMoveCategory(outlet) {
  const qc = useQueryClient();
  const key = ["menu", outlet?._id];
  return useMutation({
    mutationFn: (body) => api.moveCategory(outlet, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      if (prev) {
        const plan = planCategoryMove(prev.categories, body.id, body.parentId ?? null, body.beforeId ?? null);
        if (plan.ok) {
          const by = new Map(plan.changes.map((c) => [c.id, c]));
          qc.setQueryData(key, { ...prev, categories: prev.categories.map((c) => (by.has(c.id) ? { ...c, ...by.get(c.id) } : c)) });
        }
      }
      return { prev };
    },
    onError: (_e, _b, c) => c?.prev && qc.setQueryData(key, c.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export const useReorderCategories = (o         ) =>
  useMenuMutation(o, (outlet, ids) => api.reorderCategories(outlet, ids));

export const useDeleteItems = (o         ) =>
  useMenuMutation(o, (outlet, ids) => api.deleteItems(outlet, ids));

export const useCreateItem = (o         ) =>
  useMenuMutation                                                      (o, (outlet, body) =>
    api.createItem(outlet, body),
  );

export const useUpdateItem = (o         ) =>
  useMenuMutation                                     (o, (outlet, a) =>
    api.updateItem(outlet, a.id, a.body),
  );

export const useDeleteItem = (o         ) =>
  useMenuMutation        (o, (outlet, id) => api.deleteItem(outlet, id));

export const useCreateModifierGroup = (o         ) =>
  useMenuMutation                                   (o, (outlet, body) =>
    api.createModifierGroup(outlet, body),
  );

export const useDeleteModifierGroup = (o         ) =>
  useMenuMutation        (o, (outlet, id) => api.deleteModifierGroup(outlet, id));

export const useImportMenu = (o         ) =>
  useMenuMutation        (o, (outlet, body) => api.importMenu(outlet, body));

