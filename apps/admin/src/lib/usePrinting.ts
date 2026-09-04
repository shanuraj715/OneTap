import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PrintDocType, PrintJobStatus, PrintTemplate } from "@onetap/config-schema";
import * as api from "./api";
import type { Outlet, PrinterInput } from "./api";

export function usePrinters(outlet: Outlet | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["printers", outlet?._id],
    queryFn: () => api.listPrinters(outlet!),
    enabled: Boolean(outlet) && enabled,
  });
}

export function useTemplates(outlet: Outlet | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["print-templates", outlet?._id],
    queryFn: () => api.listTemplates(outlet!),
    enabled: Boolean(outlet) && enabled,
  });
}

/**
 * The queue polls, because a job's status changes without this tab doing
 * anything — a retry fires, an agent picks it up, a printer comes back online.
 */
export function usePrintJobs(outlet: Outlet | undefined, enabled: boolean, status?: PrintJobStatus) {
  return useQuery({
    queryKey: ["print-jobs", outlet?._id, status ?? "all"],
    queryFn: () => api.listPrintJobs(outlet!, status),
    enabled: Boolean(outlet) && enabled,
    refetchInterval: 5_000,
  });
}

function usePrintMutation<T>(outlet: Outlet | undefined, fn: (o: Outlet, a: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: T) => fn(outlet!, a),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["printers"] });
      qc.invalidateQueries({ queryKey: ["print-templates"] });
      qc.invalidateQueries({ queryKey: ["print-jobs"] });
    },
  });
}

export const useCreatePrinter = (o?: Outlet) =>
  usePrintMutation<Partial<PrinterInput>>(o, api.createPrinter);
export const useUpdatePrinter = (o?: Outlet) =>
  usePrintMutation<{ id: string; patch: Partial<PrinterInput> }>(o, (out, a) => api.updatePrinter(out, a.id, a.patch));
export const useDeletePrinter = (o?: Outlet) => usePrintMutation<string>(o, api.deletePrinter);
export const useTestPrint = (o?: Outlet) => usePrintMutation<string>(o, api.testPrint);

export const useCreateTemplate = (o?: Outlet) =>
  usePrintMutation<Partial<PrintTemplate> & { name: string; docType: PrintDocType }>(o, api.createTemplate);
export const useUpdateTemplate = (o?: Outlet) =>
  usePrintMutation<{ id: string; patch: Partial<PrintTemplate> }>(o, (out, a) => api.updateTemplate(out, a.id, a.patch));
export const useDeleteTemplate = (o?: Outlet) => usePrintMutation<string>(o, api.deleteTemplate);

export const useRetryJob = (o?: Outlet) => usePrintMutation<string>(o, api.retryPrintJob);
export const useReprintJob = (o?: Outlet) => usePrintMutation<string>(o, api.reprintJob);
export const useCancelJob = (o?: Outlet) => usePrintMutation<string>(o, api.cancelPrintJob);
export const usePrintOrderOn = (o?: Outlet) =>
  usePrintMutation<{ orderId: string; printerId: string }>(o, (out, a) => api.printOrderOn(out, a.orderId, a.printerId));
