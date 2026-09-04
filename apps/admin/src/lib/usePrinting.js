import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
                                                                                         
import * as api from "./api";
                                                  

export function usePrinters(outlet                    , enabled         ) {
  return useQuery({
    queryKey: ["printers", outlet?._id],
    queryFn: () => api.listPrinters(outlet ),
    enabled: Boolean(outlet) && enabled,
  });
}

export function useTemplates(outlet                    , enabled         ) {
  return useQuery({
    queryKey: ["print-templates", outlet?._id],
    queryFn: () => api.listTemplates(outlet ),
    enabled: Boolean(outlet) && enabled,
  });
}

/**
 * The queue polls, because a job's status changes without this tab doing
 * anything — a retry fires, an agent picks it up, a printer comes back online.
 */
export function usePrintJobs(outlet                    , enabled         , status                 ) {
  return useQuery({
    queryKey: ["print-jobs", outlet?._id, status ?? "all"],
    queryFn: () => api.listPrintJobs(outlet , status),
    enabled: Boolean(outlet) && enabled,
    refetchInterval: 5_000,
  });
}

function usePrintMutation   (outlet                    , fn                                       ) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a   ) => fn(outlet , a),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["printers"] });
      qc.invalidateQueries({ queryKey: ["print-templates"] });
      qc.invalidateQueries({ queryKey: ["print-jobs"] });
    },
  });
}

export const useCreatePrinter = (o         ) =>
  usePrintMutation                       (o, api.createPrinter);
export const useUpdatePrinter = (o         ) =>
  usePrintMutation                                              (o, (out, a) => api.updatePrinter(out, a.id, a.patch));
export const useDeletePrinter = (o         ) => usePrintMutation        (o, api.deletePrinter);
export const useTestPrint = (o         ) => usePrintMutation        (o, api.testPrint);

export const useCreateTemplate = (o         ) =>
  usePrintMutation                                                                  (o, api.createTemplate);
export const useUpdateTemplate = (o         ) =>
  usePrintMutation                                               (o, (out, a) => api.updateTemplate(out, a.id, a.patch));
export const useDeleteTemplate = (o         ) => usePrintMutation        (o, api.deleteTemplate);

export const useRetryJob = (o         ) => usePrintMutation        (o, api.retryPrintJob);
export const useReprintJob = (o         ) => usePrintMutation        (o, api.reprintJob);
export const useCancelJob = (o         ) => usePrintMutation        (o, api.cancelPrintJob);
export const usePrintOrderOn = (o         ) =>
  usePrintMutation                                        (o, (out, a) => api.printOrderOn(out, a.orderId, a.printerId));
