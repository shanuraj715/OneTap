import { useState } from "react";
                                           
import { ChevronDown, ChevronRight, Coins, Search, Users as UsersIcon } from "lucide-react";
                                                    
import { useAuth } from "../lib/useAuth";
import { useCustomers, useCustomerWallet } from "../lib/useCustomers";
import { useOutlet } from "../lib/useOutlet";
import { Card, Empty, PageHeader, Table, Td, TextInput, Th } from "../ui";

const LEDGER_LABEL                                            = {
  earn: "Earned",
  redeem: "Redeemed",
  reverse: "Refunded",
};

function fmtDate(iso        ) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function Customers() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState               (null);
  const customers = useCustomers(outlet, q);

  if (!can("customer:read")) {
    return (
      <>
        <PageHeader title="Customers" />
        <Card>Your role can&apos;t view customers.</Card>
      </>
    );
  }
  if (!outlet) {
    return (
      <>
        <PageHeader title="Customers" />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const rows = customers.data?.customers ?? [];

  return (
    <>
      <PageHeader
        title="Customers"
        icon={<UsersIcon size={23} />}
        subtitle="Everyone who has ordered here, and their coin wallet."
      />

      <Card>
        <div style={{ marginBottom: 14, maxWidth: 320 }}>
          <span style={searchWrap}>
            <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email or phone…"
              style={searchInput}
            />
          </span>
        </div>

        {customers.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <Empty icon={<UsersIcon size={28} />} title="No customers yet">
            Anyone who orders through the storefront shows up here.
          </Empty>
        ) : (
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th width={26} />
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Mobile</Th>
                <Th align="center" width={70}>Orders</Th>
                <Th align="center" width={90}>Coins</Th>
                <Th width={140}>Last order</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const isOpen = expanded === c.id;
                return (
                  <>
                    <tr
                      key={c.id}
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      style={{ cursor: "pointer", background: isOpen ? "color-mix(in srgb, var(--color-primary) 6%, var(--color-surface))" : undefined }}
                    >
                      <Td align="center">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</Td>
                      <Td>{c.name || <span style={{ color: "var(--color-text-muted)" }}>—</span>}</Td>
                      <Td>{c.email || <span style={{ color: "var(--color-text-muted)" }}>—</span>}</Td>
                      <Td nowrap>{c.phone || <span style={{ color: "var(--color-text-muted)" }}>—</span>}</Td>
                      <Td align="center">{c.orderCount}</Td>
                      <Td align="center">
                        <span style={coinPill}>
                          <Coins size={11} /> {c.walletBalance}
                        </span>
                      </Td>
                      <Td nowrap>{c.lastOrderAt ? fmtDate(c.lastOrderAt) : "—"}</Td>
                    </tr>
                    {isOpen ? (
                      <tr key={`${c.id}-detail`}>
                        <td colSpan={7} style={detailCell}>
                          <WalletLedger customerId={c.id} />
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function WalletLedger({ customerId }                        ) {
  const { outlet } = useOutlet();
  const wallet = useCustomerWallet(outlet, customerId);
  const entries = wallet.data?.entries ?? [];

  if (wallet.isLoading) return <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>Loading wallet…</p>;
  if (entries.length === 0) return <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>No coin activity yet.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map((e) => (
        <div key={e.id} style={ledgerRow}>
          <span style={{ ...ledgerCoins, color: e.coins >= 0 ? "var(--tone-success)" : "var(--tone-danger)" }}>
            {e.coins >= 0 ? "+" : ""}
            {e.coins}
          </span>
          <span style={{ fontWeight: 600, width: 74, flexShrink: 0 }}>{LEDGER_LABEL[e.kind]}</span>
          <span style={{ flex: 1, color: "var(--color-text-muted)" }}>{e.reason}</span>
          <span style={{ color: "var(--color-text-muted)" }}>balance {e.balanceAfter}</span>
          <span style={{ color: "var(--color-text-muted)", width: 130, textAlign: "right", flexShrink: 0 }}>{fmtDate(e.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

const searchWrap                = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  padding: "8px 12px",
  background: "var(--color-bg)",
};
const searchInput                = {
  flex: 1,
  border: "none",
  outline: "none",
  background: "transparent",
  font: "inherit",
  fontSize: 13.5,
  color: "var(--color-text)",
};
const coinPill                = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--tone-warning)",
  background: "var(--tone-warning-wash)",
  padding: "2px 8px",
  borderRadius: 999,
};
const detailCell                = {
  padding: "12px 18px 14px 40px",
  background: "var(--color-bg)",
  borderBottom: "1px solid var(--color-border)",
};
const ledgerRow                = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontSize: 12.5,
  padding: "4px 0",
};
const ledgerCoins                = {
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  width: 44,
  flexShrink: 0,
};
