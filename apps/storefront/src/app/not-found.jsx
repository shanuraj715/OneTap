import { AddressNotFound } from "@/components/AddressNotice";

/**
 * Every address the storefront can't show: an unknown path, or any page that
 * calls notFound(). What the visitor sees depends on whether a store uses this
 * address at all — see AddressNotice.
 */
export default function NotFound() {
  return <AddressNotFound />;
}
