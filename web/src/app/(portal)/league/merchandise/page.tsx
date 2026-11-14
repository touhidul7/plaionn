import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface OrderItem {
  id: string;
  recipient_name: string;
  size: string;
  jersey_number?: number;
  custom_nameplate?: string;
  quantity: number;
  unit_price_cents: number;
  item_subtotal_cents: number;
}

interface TeamOrder {
  id: string;
  team_entry_id: string;
  team_name?: string;
  order_status: string;
  payment_status: string;
  total_price_cents: number;
  notes?: string;
  created_at: string;
  items?: OrderItem[];
}

export default async function MerchandisePage() {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>Merchandise &amp; Jersey Management</h1>
        <p>Only league commissioners may oversee team jersey orders and apparel fulfillment.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // Fetch products and team orders
  const [productsRes, ordersRes, teamsRes] = await Promise.all([
    supabase
      .from("merchandise_products")
      .select("*")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_merchandise_orders")
      .select("*, merchandise_order_items(*)")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_entries")
      .select("id, teams(name)")
      .eq("league_id", league.id),
  ]);

  const teamNameMap: Record<string, string> = {};
  if (teamsRes.data) {
    for (const te of teamsRes.data) {
      const t = te.teams as any;
      teamNameMap[te.id] = t?.name || "Team";
    }
  }

  const products = productsRes.data || [];
  const rawOrders = ordersRes.data || [];

  const orders: TeamOrder[] = rawOrders.map((o: any) => ({
    id: o.id,
    team_entry_id: o.team_entry_id,
    team_name: teamNameMap[o.team_entry_id] || "Team Order",
    order_status: o.order_status,
    payment_status: o.payment_status,
    total_price_cents: o.total_price_cents,
    notes: o.notes,
    created_at: o.created_at,
    items: o.merchandise_order_items || [],
  }));

  const totalRevenueCents = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + o.total_price_cents, 0);

  const totalJerseysOrdered = orders
    .flatMap((o) => o.items || [])
    .reduce((sum, item) => sum + (item.quantity || 1), 0);

  async function updateOrderStatus(formData: FormData) {
    "use server";
    const orderId = formData.get("orderId") as string;
    const orderStatus = formData.get("orderStatus") as string;
    const paymentStatus = formData.get("paymentStatus") as string;

    const { supabase: actionClient } = await getLeagueContext();
    await actionClient.rpc("update_merchandise_order_status", {
      target_order_id: orderId,
      new_order_status: orderStatus,
      new_payment_status: paymentStatus,
    });
    revalidatePath("/league/merchandise");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">EQUIPMENT &amp; APPAREL</p>
          <h1>Jersey Sizing &amp; Team Orders</h1>
          <p>{league.name}</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/league" className="button">
            ← League HQ
          </Link>
        </div>
      </div>

      <div className="metrics-grid" style={{ marginBottom: "2rem" }}>
        <div className="metric-card">
          <p className="metric-label">TOTAL UNIFORMS ORDERED</p>
          <p className="metric-value">{totalJerseysOrdered}</p>
          <span className="metric-detail">Across all active team sets</span>
        </div>
        <div className="metric-card">
          <p className="metric-label">COLLECTED REVENUE</p>
          <p className="metric-value">
            ${(totalRevenueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <span className="metric-detail">Fully paid team orders</span>
        </div>
        <div className="metric-card">
          <p className="metric-label">PENDING PRODUCTION</p>
          <p className="metric-value">
            {orders.filter((o) => o.order_status === "submitted" || o.order_status === "in_production").length}
          </p>
          <span className="metric-detail">Orders queued or in-flight</span>
        </div>
      </div>

      <div className="section-heading">
        <h2>Team Order Queue</h2>
        <span>Review team jersey selections, player sizes, and custom nameplates</span>
      </div>

      <section className="panel">
        {orders.length === 0 ? (
          <div className="empty">
            <p>No team merchandise orders submitted yet.</p>
            <p className="hint">Captains can configure jersey styles and submit roster sizes from their team portal.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Items / Roster</th>
                  <th>Total</th>
                  <th>Order Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.team_name}</strong>
                      {order.notes && <p className="hint" style={{ margin: "4px 0 0" }}>{order.notes}</p>}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          order.order_status === "delivered"
                            ? "success"
                            : order.order_status === "in_production"
                            ? "info"
                            : "warning"
                        }`}
                      >
                        {order.order_status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          order.payment_status === "paid" ? "success" : "neutral"
                        }`}
                      >
                        {order.payment_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {order.items && order.items.length > 0 ? (
                        <div style={{ fontSize: "0.85rem" }}>
                          {order.items.slice(0, 3).map((it, idx) => (
                            <div key={idx} style={{ whiteSpace: "nowrap" }}>
                              • {it.recipient_name} ({it.size}{it.jersey_number ? ` #${it.jersey_number}` : ""}{it.custom_nameplate ? ` "${it.custom_nameplate}"` : ""})
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <span className="hint">+{order.items.length - 3} more items</span>
                          )}
                        </div>
                      ) : (
                        <span className="hint">No items listed</span>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      <strong>
                        ${(order.total_price_cents / 100).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <form action={updateOrderStatus} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <select
                          name="orderStatus"
                          defaultValue={order.order_status}
                          style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: "4px" }}
                        >
                          <option value="draft">Draft</option>
                          <option value="submitted">Submitted</option>
                          <option value="in_production">In Production</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <select
                          name="paymentStatus"
                          defaultValue={order.payment_status}
                          style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: "4px" }}
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="waived">Waived</option>
                        </select>
                        <button type="submit" className="button small">
                          Update
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="section-heading" style={{ marginTop: "2rem" }}>
        <h2>Available Uniforms &amp; Gear Catalog</h2>
        <span>Standard league packages available to teams</span>
      </div>

      <section className="panel">
        {products.length === 0 ? (
          <div className="empty">
            <p>Standard apparel packages active: Pro Sublimated Uniforms (YTH-S to XXL &amp; Goalie Cut).</p>
          </div>
        ) : (
          <div className="cards">
            {products.map((p: any) => (
              <div key={p.id} className="card">
                <h3>{p.name}</h3>
                <p className="hint">{p.description || "Sublimated pro uniform package"}</p>
                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: "bold" }}>
                    ${(p.unit_price_cents / 100).toFixed(2)}
                  </span>
                  <span className="badge info">{p.item_type.toUpperCase()}</span>
                </div>
                <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "#888" }}>
                  Sizes: {(p.allowed_sizes || []).join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
