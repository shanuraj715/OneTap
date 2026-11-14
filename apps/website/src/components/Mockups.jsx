import { Check, Coins, MessageCircle, Minus, Plus, Printer, ScanLine, ShoppingBag, TicketPercent, Wifi } from "lucide-react";
import { Icon } from "./Icon";

/**
 * Product pictures drawn in HTML — the website's own "screenshots". Sharp at
 * any size, nothing to download (fast pages rank better), and they never go
 * out of date with a redesign the way a PNG would. Purely illustrative, so
 * hidden from screen readers; the text beside each says what it shows.
 */

/** The hero's picture: an order arriving on the pass. */
export function KitchenTicket() {
  return (
    <div className="pass" aria-hidden="true">
      <span className="chip-float chip-a">
        <span className="dot">
          <Icon name="qr-code" size={13} />
        </span>
        Scanned at Table 5
      </span>
      <div className="ticket">
        <div className="ticket-head">
          <span>KOT #0042</span>
          <span>12:41</span>
        </div>
        <div className="ticket-table">Table 5</div>
        <div className="ticket-meta">Ground floor · 4 guests · Rahul</div>
        <hr />
        <div className="ticket-line">
          <span>2×</span>
          <span>
            Steamed Veg Momos
            <small>Full · Mayo dip · extra cheese</small>
            <small className="ticket-note">“less spicy”</small>
          </span>
        </div>
        <div className="ticket-line" style={{ marginTop: 8 }}>
          <span>1×</span>
          <span>Masala Coke</span>
        </div>
        <hr />
        <div className="ticket-head" style={{ fontWeight: 600 }}>
          <span>3 items</span>
          <span>₹400</span>
        </div>
        <span className="stamp">Sent to kitchen</span>
      </div>
      <span className="chip-float chip-b">
        <span className="dot">
          <Icon name="coins" size={13} />
        </span>
        +40 coins for Rahul
      </span>
    </div>
  );
}

const Veg = ({ non }) => <span className={`m-veg${non ? " non" : ""}`} />;

/** Dish photos (from Gazab Momos' own menu), stored with the website — small, square, lazy. */
const Dish = ({ src, className }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={`/food/${src}.webp`} alt="" width="160" height="160" loading="lazy" decoding="async" className={className} />
);

function Phone({ children, title, sub }) {
  return (
    <div className="m-phone">
      <div className="m-phone-bar">
        <span>9:41</span>
        <Wifi size={11} />
      </div>
      <div className="m-phone-head">
        <b>{title}</b>
        {sub ? <span>{sub}</span> : null}
      </div>
      <div className="m-phone-body">{children}</div>
    </div>
  );
}

function Browser({ url, children }) {
  return (
    <div className="m-browser" aria-hidden="true">
      <div className="m-browser-bar">
        <i />
        <i />
        <i />
        <span className="m-url">{url}</span>
      </div>
      <div className="m-browser-body">{children}</div>
    </div>
  );
}

/** Every order, from every channel, on one live screen. */
export function DashboardMock() {
  const rows = [
    { n: "0045", from: "QR", where: "Table 5", items: "2× Steamed Momos, Coke", s: "new", t: "0:42" },
    { n: "0044", from: "Staff", where: "Table 2", items: "Paneer Tikka Roll", s: "accepted", t: "3:10" },
    { n: "0043", from: "Online", where: "Delivery · 2.1 km", items: "Tandoori Momos ×2", s: "preparing", t: "8:25" },
    { n: "0042", from: "Online", where: "Takeaway", items: "Kurkure Momos, Cold Coffee", s: "ready", t: "12:03" },
  ];
  const label = { new: "New", accepted: "Accepted", preparing: "Preparing", ready: "Ready" };
  return (
    <Browser url="admin.tablepe.com/orders">
      <div className="m-dash-top">
        <b>Live orders</b>
        <span className="m-live">● Live</span>
        <span className="m-kpi">
          Today <b>₹18,420</b>
        </span>
      </div>
      <div className="m-rows">
        {rows.map((r) => (
          <div className="m-row" key={r.n}>
            <span className="m-num">#{r.n}</span>
            <span className={`m-src m-src-${r.from.toLowerCase()}`}>{r.from}</span>
            <span className="m-where">
              <b>{r.where}</b>
              <small>{r.items}</small>
            </span>
            <span className={`m-pill m-${r.s}`}>{label[r.s]}</span>
            <span className="m-timer">{r.t}</span>
          </div>
        ))}
      </div>
    </Browser>
  );
}

/** A guest's phone after scanning the table's QR. */
export function QrMock() {
  return (
    <div className="m-stage" aria-hidden="true">
      <Phone title="Gazab Momos" sub="Table 5 · Ground floor">
        <div className="m-chips">
          <span className="on">Momos</span>
          <span>Rolls</span>
          <span>Drinks</span>
        </div>
        {[
          ["Steamed Veg Momos", "₹110", 2, false, "steamed"],
          ["Tandoori Momos", "₹160", 0, false, "tandoori"],
          ["Cold Coffee", "₹90", 1, false, "cold-coffee"],
        ].map(([name, price, qty, non, img]) => (
          <div className="m-dish" key={name}>
            <Dish src={img} className="m-thumb" />
            <span className="m-dish-text">
              <span>
                <Veg non={non} /> {name}
              </span>
              <b>{price}</b>
            </span>
            {qty ? (
              <span className="m-step">
                <Minus size={10} />
                {qty}
                <Plus size={10} />
              </span>
            ) : (
              <span className="m-add">Add</span>
            )}
          </div>
        ))}
        <div className="m-cartbar">
          <ShoppingBag size={13} /> 3 items · ₹310 <b>Place order →</b>
        </div>
      </Phone>
      <span className="m-float m-float-a">
        <ScanLine size={14} /> Table 5 scanned
      </span>
    </div>
  );
}

/** A waiter taking the order on their own phone. */
export function StaffMock() {
  return (
    <div className="m-stage" aria-hidden="true">
      <Phone title="Take order" sub="Table 7 · Terrace">
        {[
          ["Paneer Tikka Roll", "Extra cheese", 1, "₹150"],
          ["Steamed Veg Momos", "Full · Mint dip", 2, "₹220"],
        ].map(([name, opt, qty, price]) => (
          <div className="m-line" key={name}>
            <span>
              <b>{name}</b>
              <small>{opt}</small>
            </span>
            <span className="m-step">
              <Minus size={10} />
              {qty}
              <Plus size={10} />
            </span>
            <b>{price}</b>
          </div>
        ))}
        <div className="m-cust">
          <span className="m-cust-ok">
            <Check size={12} />
          </span>
          <span>
            <b>Welcome back, Rahul</b>
            <small>98765 43210 · 7 visits · 240 coins</small>
          </span>
        </div>
        <div className="m-send">Send to kitchen · ₹370</div>
      </Phone>
      <span className="m-float m-float-b">
        <Printer size={14} /> KOT printed
      </span>
    </div>
  );
}

/** The restaurant's own ordering website. */
export function OnlineMock() {
  return (
    <Browser url="gazabmomos.com">
      <div className="m-site-head">
        <b>Gazab Momos</b>
        <span className="m-toggle">
          <span className="on">Delivery</span>
          <span>Takeaway</span>
        </span>
      </div>
      <div className="m-site-hero">Hot momos, at your door in 30 minutes.</div>
      <div className="m-cards">
        {[
          ["Steamed Momos", "₹110", "steamed"],
          ["Tandoori Momos", "₹160", "tandoori"],
          ["Paneer Momos", "₹150", "paneer"],
          ["Cold Coffee", "₹90", "cold-coffee"],
        ].map(([n, p, img]) => (
          <div className="m-card" key={n}>
            <Dish src={img} className="m-card-img" />
            <span className="m-card-text">
              <b>{n}</b>
              <span>{p}</span>
            </span>
            <span className="m-add">Add</span>
          </div>
        ))}
      </div>
    </Browser>
  );
}

/** Coins, coupons and the WhatsApp update. */
export function LoyaltyMock() {
  return (
    <div className="m-loyal" aria-hidden="true">
      <div className="m-wallet">
        <span className="m-wallet-top">
          <Coins size={16} /> Rahul's coins
        </span>
        <b>240</b>
        <span className="m-bar">
          <i style={{ width: "72%" }} />
        </span>
        <small>Worth ₹240 on the next order</small>
      </div>
      <div className="m-coupon">
        <TicketPercent size={18} />
        <span>
          <b>MOMO20</b>
          <small>20% off orders over ₹299</small>
        </span>
      </div>
      <div className="m-wa">
        <span className="m-wa-icon">
          <MessageCircle size={14} />
        </span>
        <span>
          <b>Gazab Momos</b>
          Your order #0042 is ready for pickup. You earned 40 coins!
        </span>
      </div>
    </div>
  );
}

export function ProductVisual({ kind }) {
  switch (kind) {
    case "qr":
      return <QrMock />;
    case "staff":
      return <StaffMock />;
    case "online":
      return <OnlineMock />;
    case "kitchen":
      return <KitchenTicket />;
    case "loyalty":
      return <LoyaltyMock />;
    default:
      return <DashboardMock />;
  }
}
