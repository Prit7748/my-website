export type AdminDashboardTileKey =
  | "products"
  | "bulk-product-details"
  | "bulk-product-images"
  | "combos"
  | "want-to-buy"
  | "on-demand-orders"
  | "orders"
  | "order-reports"
  | "analytics"
  | "blogs"
  | "admin-management"
  | "site-settings"
  | "notifications"
  | "subjects"
  | "courses"
  | "users"
  | "sessions"
  | "lalita"
  | "official-papers"
  | "product-pricing"
  | "on-demand-timing-rules"
  | "dashboard-tile-order";

export type AdminDashboardTileTone =
  | "default"
  | "gray"
  | "blue"
  | "cyan"
  | "violet"
  | "emerald"
  | "amber"
  | "red"
  | "rose"
  | "sky"
  | "indigo"
  | "fuchsia";

export type AdminDashboardTileConfig = {
  key: AdminDashboardTileKey;
  defaultTitle: string;
  description: string;
  href?: string;
  fixedLast?: boolean;
};

export type AdminDashboardTileSettings = {
  order: AdminDashboardTileKey[];
  hiddenKeys: AdminDashboardTileKey[];
  labelOverrides: Partial<Record<AdminDashboardTileKey, string>>;
  colorOverrides: Partial<Record<AdminDashboardTileKey, AdminDashboardTileTone>>;
};

export const ADMIN_DASHBOARD_TILE_STORAGE_KEY =
  "ignou_admin_dashboard_tile_settings_v2";

export const ADMIN_DASHBOARD_TILE_SYNC_EVENT =
  "ignou:admin-dashboard-tile-settings-updated";

export const ADMIN_DASHBOARD_TILE_TONE_OPTIONS: Array<{
  value: AdminDashboardTileTone;
  label: string;
}> = [
  { value: "default", label: "Default / Auto" },
  { value: "gray", label: "Gray" },
  { value: "blue", label: "Blue" },
  { value: "cyan", label: "Cyan" },
  { value: "violet", label: "Violet" },
  { value: "emerald", label: "Emerald" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Red" },
  { value: "rose", label: "Rose" },
  { value: "sky", label: "Sky" },
  { value: "indigo", label: "Indigo" },
  { value: "fuchsia", label: "Fuchsia" },
];

export const ADMIN_DASHBOARD_TILES: AdminDashboardTileConfig[] = [
  {
    key: "products",
    defaultTitle: "Products",
    description: "Add / edit products",
    href: "/admin/products",
  },
  {
    key: "bulk-product-details",
    defaultTitle: "Bulk Product Details",
    description: "Static template + CSV/Excel row-wise merge upload",
    href: "/admin/products/bulk/details",
  },
  {
    key: "bulk-product-images",
    defaultTitle: "Bulk Product Images",
    description: "ZIP upload + category-wise missing image report",
    href: "/admin/products/bulk/bulk-images",
  },
  {
    key: "combos",
    defaultTitle: "Combos",
    description: "Manage combo rules, bundles & SEO",
    href: "/admin/combos",
  },
  {
    key: "want-to-buy",
    defaultTitle: "Want to Buy",
    description: "Product demand enquiries",
    href: "/admin/want-to-buy",
  },
  {
    key: "on-demand-orders",
    defaultTitle: "On Demand Orders",
    description: "Pending user upload requests",
    href: "/admin/on-demand-orders",
  },
  {
    key: "orders",
    defaultTitle: "Orders",
    description: "View payments & delivery",
    href: "/admin/orders",
  },
  {
    key: "order-reports",
    defaultTitle: "Order Reports",
    description: "Revenue, products sold, trends & analytics",
    href: "/admin/order-reports",
  },
  {
    key: "analytics",
    defaultTitle: "Analytics",
    description: "SEO, source buckets, UTM, referrers & attribution report",
    href: "/admin/analytics",
  },
  {
    key: "blogs",
    defaultTitle: "Blogs",
    description: "Manage blog categories & posts",
    href: "/admin/blogs",
  },
  {
    key: "admin-management",
    defaultTitle: "Admin Management",
    description: "Create / manage admin access",
    href: "/admin/admins",
  },
  {
    key: "site-settings",
    defaultTitle: "Site Settings",
    description: "Hero, FAQ, Social links, Testimonials",
    href: "/admin/site-settings",
  },
  {
    key: "notifications",
    defaultTitle: "Notifications",
    description: "Post-upload sync tasks, alerts, pending admin actions",
    href: "/admin/notifications",
  },
  {
    key: "subjects",
    defaultTitle: "Subjects",
    description: "Codes + Titles (Excel upload)",
    href: "/admin/subjects",
  },
  {
    key: "courses",
    defaultTitle: "Courses",
    description: "Codes + Title (single title)",
    href: "/admin/courses",
  },
  {
    key: "users",
    defaultTitle: "Users",
    description: "Customers list + order count",
    href: "/admin/users",
  },
  {
    key: "sessions",
    defaultTitle: "Sessions",
    description: "Smart sessions by category",
    href: "/admin/sessions",
  },
  {
    key: "lalita",
    defaultTitle: "Lalita Bulk Upload",
    description: "Hidden secure bulk PDF upload page",
    href: "/admin/Lalita",
  },
  {
    key: "official-papers",
    defaultTitle: "IGNOU Official Papers",
    description: "Upload official / unsolved papers by SKU",
    href: "/admin/official-papers",
  },
  {
    key: "product-pricing",
    defaultTitle: "Product Pricing",
    description: "Category + course pricing rules & product overrides",
    href: "/admin/product-pricing",
  },
  {
    key: "on-demand-timing-rules",
    defaultTitle: "On Demand Timing Rules",
    description: "Category default + course-wise timer configuration",
    href: "/admin/on-demand-timing-rules",
  },
  {
    key: "dashboard-tile-order",
    defaultTitle: "Dashboard Tile Order",
    description: "Set tile order, names, and visibility",
    href: "/admin/dashboard-tile-order",
    fixedLast: true,
  },
];

export function getDefaultAdminDashboardTileOrder(): AdminDashboardTileKey[] {
  return ADMIN_DASHBOARD_TILES.map((tile) => tile.key);
}

export function getDefaultAdminDashboardTileSettings(): AdminDashboardTileSettings {
  return {
    order: getDefaultAdminDashboardTileOrder(),
    hiddenKeys: [],
    labelOverrides: {},
    colorOverrides: {},
  };
}

export function normalizeAdminDashboardTileOrder(
  raw: unknown
): AdminDashboardTileKey[] {
  const defaults = getDefaultAdminDashboardTileOrder();
  const validSet = new Set(defaults);
  const seen = new Set<AdminDashboardTileKey>();
  const cleaned: AdminDashboardTileKey[] = [];

  const arr = Array.isArray(raw) ? raw : [];

  for (const item of arr) {
    const key = String(item || "") as AdminDashboardTileKey;
    if (!validSet.has(key) || seen.has(key)) continue;
    cleaned.push(key);
    seen.add(key);
  }

  for (const key of defaults) {
    if (!seen.has(key)) {
      cleaned.push(key);
      seen.add(key);
    }
  }

  return cleaned;
}

export function normalizeAdminDashboardHiddenKeys(
  raw: unknown
): AdminDashboardTileKey[] {
  const validSet = new Set(getDefaultAdminDashboardTileOrder());
  const seen = new Set<AdminDashboardTileKey>();
  const arr = Array.isArray(raw) ? raw : [];
  const out: AdminDashboardTileKey[] = [];

  for (const item of arr) {
    const key = String(item || "") as AdminDashboardTileKey;
    if (!validSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }

  return out;
}

export function normalizeAdminDashboardLabelOverrides(
  raw: unknown
): Partial<Record<AdminDashboardTileKey, string>> {
  const out: Partial<Record<AdminDashboardTileKey, string>> = {};
  const validSet = new Set(getDefaultAdminDashboardTileOrder());

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return out;
  }

  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k || "") as AdminDashboardTileKey;
    if (!validSet.has(key)) continue;

    const value = String(v ?? "").trim();
    if (!value) continue;

    out[key] = value;
  }

  return out;
}

export function normalizeAdminDashboardColorOverrides(
  raw: unknown
): Partial<Record<AdminDashboardTileKey, AdminDashboardTileTone>> {
  const out: Partial<Record<AdminDashboardTileKey, AdminDashboardTileTone>> = {};
  const validTileSet = new Set(getDefaultAdminDashboardTileOrder());
  const validToneSet = new Set(
    ADMIN_DASHBOARD_TILE_TONE_OPTIONS.map((x) => x.value)
  );

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return out;
  }

  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k || "") as AdminDashboardTileKey;
    const value = String(v || "") as AdminDashboardTileTone;

    if (!validTileSet.has(key)) continue;
    if (!validToneSet.has(value)) continue;
    if (value === "default") continue;

    out[key] = value;
  }

  return out;
}

export function normalizeAdminDashboardTileSettings(
  raw: unknown
): AdminDashboardTileSettings {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    order: normalizeAdminDashboardTileOrder(base.order),
    hiddenKeys: normalizeAdminDashboardHiddenKeys(base.hiddenKeys),
    labelOverrides: normalizeAdminDashboardLabelOverrides(base.labelOverrides),
    colorOverrides: normalizeAdminDashboardColorOverrides(base.colorOverrides),
  };
}

export function getAdminDashboardTileMeta(
  key: AdminDashboardTileKey
): AdminDashboardTileConfig | undefined {
  return ADMIN_DASHBOARD_TILES.find((tile) => tile.key === key);
}

export function getAdminDashboardTileDisplayTitle(
  key: AdminDashboardTileKey,
  settings?: Partial<AdminDashboardTileSettings> | null
): string {
  const meta = getAdminDashboardTileMeta(key);
  const override = String(settings?.labelOverrides?.[key] ?? "").trim();
  return override || meta?.defaultTitle || key;
}

export function getAdminDashboardTilesInOrder(
  rawSettings: unknown
): AdminDashboardTileConfig[] {
  const settings = normalizeAdminDashboardTileSettings(rawSettings);
  const rank = new Map<AdminDashboardTileKey, number>();

  settings.order.forEach((key, index) => rank.set(key, index));

  const hidden = new Set(settings.hiddenKeys);

  const visible = [...ADMIN_DASHBOARD_TILES]
    .filter((tile) => !hidden.has(tile.key))
    .sort((a, b) => {
      const aRank = rank.get(a.key) ?? 999;
      const bRank = rank.get(b.key) ?? 999;
      if (aRank !== bRank) return aRank - bRank;
      return 0;
    });

  const fixedLast = visible.filter((tile) => tile.fixedLast);
  const normal = visible.filter((tile) => !tile.fixedLast);

  return [...normal, ...fixedLast];
}