import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
