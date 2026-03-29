"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  User,
  Lock,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Headphones,
  BadgeCheck,
  Truck,
  BadgePercent,
  X,
  Wallet,
  AlertTriangle,
  MapPin,
  RefreshCcw,
  Info,
  PackageCheck,
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

type MeUser = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  reseller?: {
    isReseller?: boolean;
    status?: string;
    planCode?: string;
    planName?: string;
    walletBalance?: number;
    walletTotalRecharged?: number;
    walletTotalUsed?: number;
    walletTotalDiscountSaved?: number;
    sellerBenefitsActive?: boolean;
    minimumActiveWalletBalance?: number;
  };
};

type AppliedPromo = {
  code: string;
  reason?: string;
  discountAmount: number;
  eligibleSubtotal: number;
  cartSubtotal: number;
  finalTotal: number;
  matchedProductIds: string[];
  matchedCategories: string[];
  promo?: {
    code: string;
    title: string;
    description: string;
    badgeText: string;
    publicNote: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    maxDiscountAmount: number;
  } | null;
};

type PinLookupOffice = {
  name: string;
  branchType: string;
  deliveryStatus: string;
  district: string;
  state: string;
  block: string;
  division: string;
  region: string;
  circle: string;
  country: string;
};

type PinLookupResponse = {
  ok?: boolean;
  error?: string;
  pincode?: string;
  city?: string;
  district?: string;
  state?: string;
  region?: string;
  circle?: string;
  postOffices?: PinLookupOffice[];
};

type DeliverySettings = {
  deliveryChargeEnabled: boolean;
  deliveryChargeThresholdAmount: number;
  deliveryChargeAmount: number;
  deliveryChargeLabel: string;
  freeDeliveryLabel: string;
};

type AttributionSnapshot = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  referrer_host?: string;
  landing_path?: string;
  landing_url?: string;
  source_bucket?: string;
  detected_source?: string;
  is_direct?: boolean;
  captured_at?: string;
};

type StoredAttribution = {
  firstTouch?: AttributionSnapshot | null;
  lastTouch?: AttributionSnapshot | null;
};

const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  deliveryChargeEnabled: true,
  deliveryChargeThresholdAmount: 1000,
  deliveryChargeAmount: 100,
  deliveryChargeLabel: "Delivery Charge",
  freeDeliveryLabel: "Free Delivery",
};

const ATTRIBUTION_STORAGE_KEY = "isp_attribution_store_v1";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function roundSafe(x: any) {
  const n = Number(x);
  const safe = Number.isFinite(n) ? n : 0;
  return Math.round(safe * 100) / 100;
}

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Number(n || 0));
  } catch {
    return String(n);
  }
}

function isComboCartItem(item: any) {
  return safeStr(item?.itemType).toLowerCase() === "combo";
}

function isHardcopyCartItem(item: any) {
  const category = safeStr(item?.category).toLowerCase();
  const title = safeStr(item?.title).toLowerCase();
  const comboCategorySlug = safeStr(item?.comboCategorySlug).toLowerCase();

  return (
    category.includes("handwritten hardcopy") ||
    category.includes("hardcopy") ||
    comboCategorySlug.includes("handwritten-hardcopy") ||
    title.includes("hardcopy") ||
    title.includes("delivery")
  );
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function normalizePincode(input: any) {
  return safeStr(input).replace(/\D/g, "").slice(0, 6);
}

function buildDisplayAddress(parts: {
  addressLine1?: string;
  areaLocality?: string;
  landmark?: string;
  postOffice?: string;
  city?: string;
  state?: string;
  pincode?: string;
}) {
  return [
    safeStr(parts.addressLine1),
    safeStr(parts.areaLocality),
    safeStr(parts.landmark) ? `Near ${safeStr(parts.landmark)}` : "",
    safeStr(parts.postOffice),
    safeStr(parts.city),
    safeStr(parts.state),
    safeStr(parts.pincode),
  ]
    .filter(Boolean)
    .join(", ");
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readBrowserAttributionStore(): StoredAttribution | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    return safeJsonParse<StoredAttribution>(raw, { firstTouch: null, lastTouch: null });
  } catch {
    return null;
  }
}

export default function CheckoutClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { cart, cartTotal, clearCart, cartReady } = useCart();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [err, setErr] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<MeUser | null>(null);

  const initialCoupon = safeStr(sp.get("coupon") || "").toUpperCase();
  const [couponInput, setCouponInput] = useState(initialCoupon);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [autoCouponTried, setAutoCouponTried] = useState(false);

  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [postOfficeOptions, setPostOfficeOptions] = useState<PinLookupOffice[]>([]);
  const [lastLookupPin, setLastLookupPin] = useState("");
  const [manualAddressMode, setManualAddressMode] = useState(false);

  const [deliverySettings, setDeliverySettings] =
    useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);
  const [deliverySettingsLoading, setDeliverySettingsLoading] = useState(false);

  const hasPhysicalItem = useMemo(() => {
    return cart.some((item: any) => isHardcopyCartItem(item));
  }, [cart]);

  const promoPayloadItems = useMemo(() => {
    return cart.map((it: any) => ({
      productId: String(it.id || ""),
      title: safeStr(it.title),
      category: safeStr(it.category),
      price: safeNum(it.price, 0),
      quantity: safeNum(it.quantity, 1),
      itemType: safeStr(it.itemType || "product"),
      comboSlug: safeStr(it.comboSlug),
      comboCategorySlug: safeStr(it.comboCategorySlug),
      comboBuilderProductIds: Array.isArray(it?.comboBuilderProductIds)
        ? it.comboBuilderProductIds.map((x: any) => safeStr(x)).filter(Boolean)
        : [],
    }));
  }, [cart]);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",

    addressLine1: "",
    areaLocality: "",
    landmark: "",
    postOffice: "",
    pincode: "",
    city: "",
    state: "",
  });

  const selectedPostOffice = useMemo(() => {
    return postOfficeOptions.find((po) => po.name === formData.postOffice) || null;
  }, [postOfficeOptions, formData.postOffice]);

  const composedAddress = useMemo(() => {
    return buildDisplayAddress({
      addressLine1: formData.addressLine1,
      areaLocality: formData.areaLocality,
      landmark: formData.landmark,
      postOffice: formData.postOffice,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
    });
  }, [formData]);

  const discount = useMemo(() => {
    return roundSafe(appliedPromo?.discountAmount || 0);
  }, [appliedPromo]);

  const hardcopyItemsSubtotal = useMemo(() => {
    return roundSafe(
      cart.reduce((acc: number, item: any) => {
        if (!isHardcopyCartItem(item)) return acc;
        return acc + safeNum(item.price, 0) * safeNum(item.quantity, 1);
      }, 0)
    );
  }, [cart]);

  const matchedHardcopySubtotal = useMemo(() => {
    if (!appliedPromo) return 0;

    return roundSafe(
      cart.reduce((acc: number, item: any) => {
        if (!isHardcopyCartItem(item)) return acc;

        const productId = safeStr(item?.id);
        const category = safeStr(item?.category);
        const matchedById = appliedPromo.matchedProductIds.includes(productId);
        const matchedByCategory = appliedPromo.matchedCategories.includes(category);

        if (!matchedById && !matchedByCategory) return acc;
        return acc + safeNum(item.price, 0) * safeNum(item.quantity, 1);
      }, 0)
    );
  }, [cart, appliedPromo]);

  const promoDiscountAllocatedToHardcopy = useMemo(() => {
    if (!appliedPromo || discount <= 0 || hardcopyItemsSubtotal <= 0) return 0;

    const hasTargetedPromo =
      appliedPromo.matchedProductIds.length > 0 || appliedPromo.matchedCategories.length > 0;

    if (hasTargetedPromo) {
      if (matchedHardcopySubtotal <= 0 || appliedPromo.eligibleSubtotal <= 0) return 0;
      return roundSafe((discount * matchedHardcopySubtotal) / appliedPromo.eligibleSubtotal);
    }

    if (cartTotal <= 0) return 0;
    return roundSafe((discount * hardcopyItemsSubtotal) / cartTotal);
  }, [appliedPromo, discount, hardcopyItemsSubtotal, matchedHardcopySubtotal, cartTotal]);

  const estimatedHardcopySubtotalAfterDiscount = useMemo(() => {
    return roundSafe(Math.max(0, hardcopyItemsSubtotal - promoDiscountAllocatedToHardcopy));
  }, [hardcopyItemsSubtotal, promoDiscountAllocatedToHardcopy]);

  const estimatedDeliveryCharge = useMemo(() => {
    if (!hasPhysicalItem) return 0;
    if (!deliverySettings.deliveryChargeEnabled) return 0;
    if (estimatedHardcopySubtotalAfterDiscount <= 0) return 0;
    if (
      estimatedHardcopySubtotalAfterDiscount <
      safeNum(deliverySettings.deliveryChargeThresholdAmount, 0)
    ) {
      return roundSafe(deliverySettings.deliveryChargeAmount);
    }
    return 0;
  }, [hasPhysicalItem, deliverySettings, estimatedHardcopySubtotalAfterDiscount]);

  const itemsTotalAfterDiscount = useMemo(() => {
    return roundSafe(Math.max(0, safeNum(cartTotal, 0) - discount));
  }, [cartTotal, discount]);

  const estimatedGrandTotal = useMemo(() => {
    return roundSafe(itemsTotalAfterDiscount + estimatedDeliveryCharge);
  }, [itemsTotalAfterDiscount, estimatedDeliveryCharge]);

  const reseller = currentUser?.reseller || {};
  const walletBalance = roundSafe(reseller?.walletBalance || 0);
  const sellerBenefitsActive = Boolean(reseller?.sellerBenefitsActive);
  const minimumActiveWalletBalance = safeNum(reseller?.minimumActiveWalletBalance, 10);
  const sellerPlanName = safeStr(reseller?.planName || reseller?.planCode || "");
  const hasWalletCredit = walletBalance > 0;

  function buildCheckoutUrl(nextCoupon?: string) {
    const code = safeStr(nextCoupon).toUpperCase();
    return code ? `/checkout?coupon=${encodeURIComponent(code)}` : "/checkout";
  }

  async function applyCoupon(codeToApply?: string, silent = false) {
    const code = safeStr(codeToApply ?? couponInput).toUpperCase();

    if (!silent) {
      setPromoMessage("");
    }
    setErr("");

    if (!code) {
      setAppliedPromo(null);
      if (!silent) setPromoMessage("Please enter a promo code.");
      router.replace("/checkout", { scroll: false });
      return;
    }

    if (!cartReady) return;

    if (!cart.length) {
      setAppliedPromo(null);
      if (!silent) setPromoMessage("Your cart is empty.");
      return;
    }

    setPromoLoading(true);

    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          coupon: code,
          items: promoPayloadItems,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.valid) {
        setAppliedPromo(null);
        setCouponInput(code);

        if (!silent) {
          setPromoMessage(safeStr(data?.reason || data?.error) || "Promo code is not valid.");
        }

        router.replace(buildCheckoutUrl(code), { scroll: false });
        return;
      }

      const promoState: AppliedPromo = {
        code: safeStr(data?.code || code).toUpperCase(),
        reason: safeStr(data?.reason),
        discountAmount: safeNum(data?.discountAmount, 0),
        eligibleSubtotal: safeNum(data?.eligibleSubtotal, 0),
        cartSubtotal: safeNum(data?.cartSubtotal, 0),
        finalTotal: safeNum(data?.finalTotal, 0),
        matchedProductIds: Array.isArray(data?.matchedProductIds) ? data.matchedProductIds : [],
        matchedCategories: Array.isArray(data?.matchedCategories) ? data.matchedCategories : [],
        promo: data?.promo || null,
      };

      setAppliedPromo(promoState);
      setCouponInput(promoState.code);

      if (!silent) {
        setPromoMessage(
          `${promoState.code} applied successfully. You saved ₹${promoState.discountAmount}.`
        );
      }

      router.replace(buildCheckoutUrl(promoState.code), { scroll: false });
    } catch {
      setAppliedPromo(null);
      if (!silent) {
        setPromoMessage("Promo validation failed. Please try again.");
      }
    } finally {
      setPromoLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedPromo(null);
    setCouponInput("");
    setPromoMessage("");
    setErr("");
    setAutoCouponTried(true);
    router.replace("/checkout", { scroll: false });
  }

  async function lookupPincode(pin: string) {
    const normalized = normalizePincode(pin);

    if (!/^\d{6}$/.test(normalized)) {
      setPincodeLoading(false);
      setPincodeError("");
      setPostOfficeOptions([]);
      setLastLookupPin("");
      return;
    }

    if (normalized === lastLookupPin) {
      return;
    }

    setPincodeLoading(true);
    setPincodeError("");

    try {
      const res = await fetch(`/api/address/pincode?pincode=${encodeURIComponent(normalized)}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as PinLookupResponse;

      if (!res.ok || !data?.ok) {
        setPostOfficeOptions([]);
        setPincodeError(data?.error || "Pincode lookup failed.");
        setLastLookupPin(normalized);
        return;
      }

      const offices = Array.isArray(data?.postOffices) ? data.postOffices : [];
      setPostOfficeOptions(offices);
      setLastLookupPin(normalized);

      setFormData((prev) => {
        const previousSelectionStillValid = offices.some((po) => po.name === prev.postOffice);
        const selected = previousSelectionStillValid
          ? offices.find((po) => po.name === prev.postOffice) || offices[0] || null
          : offices[0] || null;

        return {
          ...prev,
          pincode: normalized,
          postOffice: selected?.name || prev.postOffice || "",
          city: safeStr(selected?.district || data?.city || prev.city),
          state: safeStr(selected?.state || data?.state || prev.state),
        };
      });
    } catch (e: any) {
      setPostOfficeOptions([]);
      setPincodeError(safeStr(e?.message || "Pincode lookup failed."));
      setLastLookupPin(normalized);
    } finally {
      setPincodeLoading(false);
    }
  }

  function handleInputChange(e: any) {
    const { name, value } = e.target;

    if (name === "pincode") {
      const pin = normalizePincode(value);
      setFormData((prev) => ({
        ...prev,
        pincode: pin,
        postOffice: pin !== prev.pincode ? "" : prev.postOffice,
        city: pin !== prev.pincode ? "" : prev.city,
        state: pin !== prev.pincode ? "" : prev.state,
      }));
      if (pin.length < 6) {
        setPostOfficeOptions([]);
        setPincodeError("");
        setLastLookupPin("");
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  useEffect(() => {
    let alive = true;

    async function loadDeliverySettings() {
      setDeliverySettingsLoading(true);
      try {
        const res = await fetch("/api/site-settings/hardcopy-delivery", {
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!alive) return;

        if (!res.ok || !data?.ok) {
          setDeliverySettings(DEFAULT_DELIVERY_SETTINGS);
          return;
        }

        setDeliverySettings({
          deliveryChargeEnabled: Boolean(
            data?.settings?.deliveryChargeEnabled ?? DEFAULT_DELIVERY_SETTINGS.deliveryChargeEnabled
          ),
          deliveryChargeThresholdAmount: safeNum(
            data?.settings?.deliveryChargeThresholdAmount,
            DEFAULT_DELIVERY_SETTINGS.deliveryChargeThresholdAmount
          ),
          deliveryChargeAmount: safeNum(
            data?.settings?.deliveryChargeAmount,
            DEFAULT_DELIVERY_SETTINGS.deliveryChargeAmount
          ),
          deliveryChargeLabel:
            safeStr(data?.settings?.deliveryChargeLabel) ||
            DEFAULT_DELIVERY_SETTINGS.deliveryChargeLabel,
          freeDeliveryLabel:
            safeStr(data?.settings?.freeDeliveryLabel) ||
            DEFAULT_DELIVERY_SETTINGS.freeDeliveryLabel,
        });
      } catch {
        if (!alive) return;
        setDeliverySettings(DEFAULT_DELIVERY_SETTINGS);
      } finally {
        if (alive) setDeliverySettingsLoading(false);
      }
    }

    loadDeliverySettings();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setCouponInput(initialCoupon);
    setAutoCouponTried(false);
  }, [initialCoupon]);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const redirect = buildCheckoutUrl(initialCoupon);

        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          setIsAuthenticated(false);
          setAuthLoading(false);
          router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
          return;
        }

        const data = await res.json();
        const user: MeUser = data?.user || {};

        setCurrentUser(user);
        setIsAuthenticated(true);
        setFormData((prev) => ({
          ...prev,
          fullName: safeStr(user?.name),
          email: safeStr(user?.email),
          phone: safeStr(user?.phone),
        }));
      } catch {
        if (!alive) return;
        setIsAuthenticated(false);
        router.replace(`/login?redirect=${encodeURIComponent(buildCheckoutUrl(initialCoupon))}`);
      } finally {
        if (alive) setAuthLoading(false);
      }
    }

    loadMe();

    return () => {
      alive = false;
    };
  }, [router, initialCoupon]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (!cartReady) return;
    if (autoCouponTried) return;

    const code = safeStr(initialCoupon).toUpperCase();
    if (!code) {
      setAutoCouponTried(true);
      return;
    }

    if (!cart.length) return;

    void applyCoupon(code, true);
    setAutoCouponTried(true);
  }, [authLoading, isAuthenticated, cartReady, autoCouponTried, initialCoupon, cart.length]);

  useEffect(() => {
    if (!cartReady) return;
    if (!appliedPromo) return;

    const appliedCode = safeStr(appliedPromo.code).toUpperCase();
    if (!appliedCode) return;

    if (!cart.length) {
      setAppliedPromo(null);
      return;
    }

    void applyCoupon(appliedCode, true);
  }, [cart, cartReady]);

  useEffect(() => {
    if (!hasPhysicalItem) return;

    const pin = normalizePincode(formData.pincode);
    if (!/^\d{6}$/.test(pin)) return;

    const t = setTimeout(() => {
      void lookupPincode(pin);
    }, 450);

    return () => clearTimeout(t);
  }, [formData.pincode, hasPhysicalItem]);

  useEffect(() => {
    if (!selectedPostOffice) return;

    setFormData((prev) => ({
      ...prev,
      city: safeStr(selectedPostOffice.district || prev.city),
      state: safeStr(selectedPostOffice.state || prev.state),
    }));
  }, [selectedPostOffice]);

  const CREATE_ORDER_API = "/api/payments/razorpay/create-order";
  const VERIFY_API = "/api/payments/razorpay/verify";

  const handleCompleteOrder = async () => {
    setErr("");

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(buildCheckoutUrl(couponInput))}`);
      return;
    }

    if (!cartReady) return;

    if (!cart || cart.length === 0) {
      router.push("/cart");
      return;
    }

    if (!formData.fullName || !formData.email || !formData.phone) {
      alert("Please fill in your contact details.");
      return;
    }

    if (hasPhysicalItem) {
      if (
        !formData.addressLine1 ||
        !formData.areaLocality ||
        !formData.pincode ||
        !formData.city ||
        !formData.state
      ) {
        alert("Please fill the complete shipping address for hardcopy delivery.");
        return;
      }

      if (!manualAddressMode && postOfficeOptions.length > 0 && !formData.postOffice) {
        alert("Please select a Post Office / Locality.");
        return;
      }
    }

    if (!isAgreed) {
      alert("Please accept the Terms & Conditions.");
      return;
    }

    const normalizedCouponInput = safeStr(couponInput).toUpperCase();
    const appliedCouponCode = safeStr(appliedPromo?.code).toUpperCase();

    if (normalizedCouponInput && normalizedCouponInput !== appliedCouponCode) {
      alert("Please apply the promo code first, or remove it before continuing.");
      return;
    }

    setIsProcessing(true);

    try {
      const payload = {
        coupon: appliedCouponCode || "",
        customer: {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        },
        shipping: hasPhysicalItem
          ? {
              address: composedAddress,
              addressLine1: safeStr(formData.addressLine1),
              areaLocality: safeStr(formData.areaLocality),
              landmark: safeStr(formData.landmark),
              postOffice: safeStr(formData.postOffice),
              city: safeStr(formData.city),
              district: safeStr(selectedPostOffice?.district || formData.city),
              state: safeStr(formData.state),
              pincode: normalizePincode(formData.pincode),
              country: "India",
            }
          : null,
        items: cart.map((it: any) => ({
          productId: String(it.id || ""),
          title: safeStr(it.title),
          category: safeStr(it.category),
          price: safeNum(it.price, 0),
          quantity: safeNum(it.quantity, 1),

          itemType: safeStr(it.itemType || "product"),
          comboSlug: safeStr(it.comboSlug),
          comboCategorySlug: safeStr(it.comboCategorySlug),
          comboBadge: safeStr(it.comboBadge),
          comboSaveLabel: safeStr(it.comboSaveLabel),
          comboMediumLabel: safeStr(it.comboMediumLabel),
          comboSessionLabel: safeStr(it.comboSessionLabel),
          comboBuilderProductIds: Array.isArray(it?.comboBuilderProductIds)
            ? it.comboBuilderProductIds.map((x: any) => safeStr(x)).filter(Boolean)
            : [],
          comboItems: Array.isArray(it.comboItems)
            ? it.comboItems.map((x: any) => ({
                title: safeStr(x?.title),
                subtitle: safeStr(x?.subtitle),
              }))
            : [],
        })),
        totals: {
          cartTotal: safeNum(cartTotal, 0),
          discount: safeNum(discount, 0),
          estimatedDeliveryCharge: safeNum(estimatedDeliveryCharge, 0),
          finalTotal: safeNum(estimatedGrandTotal, 0),
        },
        hasPhysicalItem,
      };

      const r1 = await fetch(CREATE_ORDER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const d1 = await r1.json().catch(() => ({}));

      if (!r1.ok) {
        if (r1.status === 409 && d1?.code === "PRODUCTS_BLOCKED") {
          const names = Array.isArray(d1?.blockedItems)
            ? d1.blockedItems.map((x: any) => safeStr(x?.title)).filter(Boolean)
            : [];

          setErr(
            names.length
              ? `These products are currently not purchasable: ${names.join(", ")}`
              : d1?.error || "Some products are not available right now."
          );
        } else if (d1?.code === "INVALID_PROMO_CODE") {
          setAppliedPromo(null);
          setErr(d1?.error || "Promo code is invalid.");
          setPromoMessage(d1?.error || "Promo code is invalid.");
        } else {
          setErr(d1?.error || "Create order failed.");
        }
        return;
      }

      if (safeStr(d1?.paymentMode).toLowerCase() === "wallet_only") {
        clearCart();
        router.push("/order-success");
        router.refresh();
        return;
      }

      const ok = await loadRazorpayScript();
      if (!ok) {
        setErr("Razorpay SDK failed to load. Please check your internet connection or ad blocker.");
        return;
      }

      const keyId = safeStr(
        d1?.keyId || d1?.razorpayKeyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ""
      );
      const razorpayOrderId = safeStr(d1?.razorpayOrderId || d1?.orderId || d1?.id || "");
      const amount = safeNum(d1?.amount, Math.round(estimatedGrandTotal * 100));
      const currency = safeStr(d1?.currency || "INR");
      const orderRef = safeStr(d1?.orderRef || "");

      if (!keyId) {
        setErr("Razorpay key is missing.");
        return;
      }

      if (!razorpayOrderId) {
        setErr("Razorpay order ID is missing from the create-order response.");
        return;
      }

      const analyticsPayload = readBrowserAttributionStore() || {
        firstTouch: null,
        lastTouch: null,
      };

      const options = {
        key: keyId,
        amount,
        currency,
        name: "IGNOU Students Portal",
        description: hasPhysicalItem ? "Study Material & Hardcopy Delivery" : "Digital Study Material",
        image: "/logo.png",
        order_id: razorpayOrderId,
        prefill: {
          name: formData.fullName,
          email: formData.email,
          contact: formData.phone,
        },
        theme: { color: "#2563EB" },
        handler: async (response: any) => {
          try {
            const vr = await fetch(VERIFY_API, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                razorpay_order_id: response?.razorpay_order_id,
                razorpay_payment_id: response?.razorpay_payment_id,
                razorpay_signature: response?.razorpay_signature,
                orderRef,
                analytics: analyticsPayload,
              }),
            });

            const vd = await vr.json().catch(() => ({}));

            if (!vr.ok) {
              setErr(vd?.error || "Payment verification failed.");
              return;
            }

            clearCart();
            router.push("/order-success");
            router.refresh();
          } catch {
            setErr("Verification request failed.");
          }
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (e: any) {
      setErr(e?.message || "Checkout failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading || !cartReady) {
    return (
      <main className="min-h-screen font-sans text-slate-800 bg-white">
        <Navbar />
        <div className="max-w-[1200px] mx-auto px-4 py-24">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">Preparing checkout...</h2>
            <p className="text-sm text-slate-500 mt-2">Please wait.</p>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen font-sans text-slate-800">
      <Navbar />

      <div className="bg-gray-100 border-b border-gray-200 py-3">
        <div className="max-w-[1200px] mx-auto px-4 text-xs md:text-sm text-gray-500 flex items-center gap-2">
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
          <ChevronRight size={12} />
          <Link href="/cart" className="hover:text-blue-600">
            Cart
          </Link>
          <ChevronRight size={12} />
          <span className="text-slate-800 font-bold">Checkout</span>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100 py-6">
        <div className="max-w-[600px] mx-auto px-4">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-100 -z-10 -translate-y-1/2"></div>

            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-200 ring-4 ring-blue-50">
                1
              </div>
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Details</span>
            </div>

            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Payment</span>
            </div>

            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Done</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#FFF5F7] py-12">
        <div className="max-w-[1200px] mx-auto px-4">
          {cart.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-pink-100 shadow-sm">
              <h2 className="text-xl font-bold text-slate-500">Your cart is empty.</h2>
              <Link href="/" className="text-blue-600 font-bold hover:underline mt-2 inline-block">
                Go Home
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
                  You are logged in. Your saved basic details have been auto-filled below.
                </div>

                {hasWalletCredit ? (
                  <div
                    className={`rounded-xl p-4 border ${
                      sellerBenefitsActive
                        ? "bg-violet-50 border-violet-200 text-violet-900"
                        : "bg-amber-50 border-amber-200 text-amber-900"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 shrink-0 ${
                          sellerBenefitsActive ? "text-violet-700" : "text-amber-700"
                        }`}
                      >
                        {sellerBenefitsActive ? <Wallet size={20} /> : <AlertTriangle size={20} />}
                      </div>

                      <div>
                        <div className="font-bold">
                          {sellerBenefitsActive
                            ? `${sellerPlanName || "Seller"} wallet available`
                            : "Wallet balance available, but seller benefits are inactive"}
                        </div>

                        <div className="mt-1 text-sm leading-relaxed">
                          Current wallet balance: <span className="font-extrabold">₹{walletBalance}</span>.
                          Wallet credit is adjusted automatically during order creation. If any balance
                          remains unpaid, Razorpay will collect the remaining amount.
                        </div>

                        <div className="mt-2 text-xs font-semibold opacity-90">
                          Seller benefits become inactive when the wallet balance goes below ₹
                          {minimumActiveWalletBalance}, but any remaining wallet balance can still be used.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100">
                    <div className="bg-blue-50 p-2 rounded-full text-blue-600">
                      <User size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Contact Details</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="fullName"
                        type="text"
                        value={formData.fullName}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="email"
                        type="email"
                        value={formData.email}
                        placeholder="student@gmail.com"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        placeholder="+91 99999 99999"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                {cart.some((item: any) => item?.itemType === "combo") ? (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3 items-start text-violet-900 text-sm">
                    <CheckCircle size={20} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Combo bundle detected in your cart</div>
                      <div className="mt-1 text-violet-800">
                        Combo included items, medium, and session details are shown clearly in the
                        order summary below.
                      </div>
                    </div>
                  </div>
                ) : null}

                {hasPhysicalItem ? (
                  <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100">
                      <div className="bg-orange-50 p-2 rounded-full text-orange-600">
                        <Truck size={20} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Delivery Address</h2>
                        <p className="text-xs text-slate-500">
                          A complete shipping address is required for hardcopy delivery.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 mb-5">
                      <div className="flex items-start gap-3">
                        <MapPin size={18} className="mt-0.5 shrink-0" />
                        <div>
                          <div className="font-bold">Pincode based autofill</div>
                          <div className="mt-1">
                            Enter a 6 digit pincode to auto-load city, state, and available post
                            office options.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          House / Flat / Building <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="addressLine1"
                          type="text"
                          value={formData.addressLine1}
                          placeholder="House no, floor, building name"
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          Area / Locality / Street <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="areaLocality"
                          type="text"
                          value={formData.areaLocality}
                          placeholder="Area, street, village, locality"
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          Landmark
                        </label>
                        <input
                          name="landmark"
                          type="text"
                          value={formData.landmark}
                          placeholder="Near school / market / temple"
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          Pincode <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="pincode"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={formData.pincode}
                          placeholder="110001"
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                          onChange={handleInputChange}
                        />
                        {pincodeLoading ? (
                          <div className="text-xs font-semibold text-blue-600">Checking pincode...</div>
                        ) : null}
                        {!pincodeLoading && pincodeError ? (
                          <div className="text-xs font-semibold text-rose-600">{pincodeError}</div>
                        ) : null}
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                            Post Office / Locality{" "}
                            {postOfficeOptions.length > 0 ? (
                              <span className="text-red-500">*</span>
                            ) : null}
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              setManualAddressMode((prev) => !prev);
                              if (!manualAddressMode) {
                                setPostOfficeOptions([]);
                                setPincodeError("");
                              } else if (/^\d{6}$/.test(normalizePincode(formData.pincode))) {
                                void lookupPincode(formData.pincode);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                          >
                            <RefreshCcw size={13} />
                            {manualAddressMode ? "Use pincode autofill" : "Manual mode"}
                          </button>
                        </div>

                        {manualAddressMode ? (
                          <input
                            name="postOffice"
                            type="text"
                            value={formData.postOffice}
                            placeholder="Enter locality / post office"
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                            onChange={handleInputChange}
                          />
                        ) : postOfficeOptions.length > 0 ? (
                          <select
                            name="postOffice"
                            value={formData.postOffice}
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
                            onChange={handleInputChange}
                          >
                            <option value="">Select post office / locality</option>
                            {postOfficeOptions.map((po) => (
                              <option key={`${po.name}-${po.branchType}`} value={po.name}>
                                {po.name}
                                {po.branchType ? ` • ${po.branchType}` : ""}
                                {po.deliveryStatus ? ` • ${po.deliveryStatus}` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            name="postOffice"
                            type="text"
                            value={formData.postOffice}
                            placeholder="Post office / locality"
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                            onChange={handleInputChange}
                          />
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          City / District <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="city"
                          type="text"
                          value={formData.city}
                          placeholder="District / city"
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          State <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="state"
                          type="text"
                          value={formData.state}
                          placeholder="State"
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    {composedAddress ? (
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                          Shipping Preview
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-800 leading-6">
                          {composedAddress}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-center text-green-800 text-sm">
                    <CheckCircle size={20} />
                    <span>No shipping address is required. You are purchasing digital products only.</span>
                  </div>
                )}

                <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100">
                    <div className="bg-purple-50 p-2 rounded-full text-purple-600">
                      <CreditCard size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Payment Method</h2>
                  </div>

                  {hasWalletCredit ? (
                    <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
                      <div className="font-bold">Auto wallet + payment gateway flow</div>
                      <div className="mt-1">
                        Available wallet: <span className="font-extrabold">₹{walletBalance}</span>.
                        Wallet credit is adjusted automatically at order creation. If any amount is
                        still payable, Razorpay will open for the remaining balance.
                      </div>
                    </div>
                  ) : null}

                  <div className="p-4 border border-blue-200 bg-blue-50/50 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-blue-50 transition">
                    <div className="h-5 w-5 rounded-full border-[6px] border-blue-600 bg-white shadow-sm"></div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-sm">Razorpay Secure Payment</h3>
                      <p className="text-xs text-slate-500">
                        UPI, Wallet, Cards, and NetBanking
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-70">
                      <div className="h-6 w-10 bg-white rounded border border-gray-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                        UPI
                      </div>
                      <div className="h-6 w-10 bg-white rounded border border-gray-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                        CARD
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5 ml-1">
                    <Lock size={12} /> 100% encrypted and secure connection.
                  </p>

                  {err ? (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-bold text-red-700">
                      {err}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-4">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg shadow-gray-200/50">
                  <h3 className="font-bold text-lg text-slate-900 mb-4 border-b border-gray-100 pb-4">
                    Order Summary
                  </h3>

                  <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BadgePercent size={18} className="text-emerald-700" />
                      <div className="text-sm font-extrabold text-emerald-900">Promo Code</div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        value={couponInput}
                        onChange={(e) => setCouponInput(safeStr(e.target.value).toUpperCase())}
                        placeholder="Enter promo code"
                        className="flex-1 px-4 py-3 bg-white border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all text-sm font-bold uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => applyCoupon()}
                        disabled={promoLoading || !couponInput || !cartReady}
                        className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm disabled:opacity-60"
                      >
                        {promoLoading ? "..." : "Apply"}
                      </button>
                    </div>

                    {appliedPromo ? (
                      <div className="mt-3 rounded-xl border border-emerald-300 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-extrabold text-emerald-900">
                              {safeStr(appliedPromo.code)}
                              {safeStr(appliedPromo?.promo?.badgeText) ? (
                                <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                                  {safeStr(appliedPromo?.promo?.badgeText)}
                                </span>
                              ) : null}
                            </div>
                            {safeStr(appliedPromo?.promo?.title) ? (
                              <div className="mt-1 text-xs font-semibold text-slate-700">
                                {safeStr(appliedPromo?.promo?.title)}
                              </div>
                            ) : null}
                            <div className="mt-1 text-xs font-bold text-emerald-700">
                              You saved ₹{roundSafe(appliedPromo.discountAmount)}
                            </div>
                            {safeStr(appliedPromo?.promo?.publicNote) ? (
                              <div className="mt-1 text-[11px] text-slate-600 font-medium">
                                {safeStr(appliedPromo?.promo?.publicNote)}
                              </div>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={removeCoupon}
                            className="h-8 w-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center"
                            aria-label="Remove promo code"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {promoMessage ? (
                      <div
                        className={`mt-3 text-xs font-bold ${
                          appliedPromo ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {promoMessage}
                      </div>
                    ) : null}
                  </div>

                  {hasWalletCredit ? (
                    <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                      <div className="flex items-center gap-2">
                        <Wallet size={18} className="text-violet-700" />
                        <div className="text-sm font-extrabold text-violet-900">Seller Wallet</div>
                      </div>

                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-600">Available Balance</span>
                          <span className="font-extrabold text-slate-900">₹{walletBalance}</span>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="text-slate-600">Benefits Status</span>
                          <span
                            className={`font-extrabold ${
                              sellerBenefitsActive ? "text-emerald-700" : "text-amber-700"
                            }`}
                          >
                            {sellerBenefitsActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 text-[11px] font-semibold text-violet-800 leading-relaxed">
                        The exact wallet deduction is calculated by the backend during order creation.
                        The payment page always uses the final verified amount.
                      </div>
                    </div>
                  ) : null}

                  {hasPhysicalItem ? (
                    <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                      <div className="flex items-center gap-2">
                        <PackageCheck size={18} className="text-orange-700" />
                        <div className="text-sm font-extrabold text-orange-900">Hardcopy Delivery Rules</div>
                      </div>

                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-600">Hardcopy Subtotal</span>
                          <span className="font-extrabold text-slate-900">
                            ₹{money(estimatedHardcopySubtotalAfterDiscount)}
                          </span>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="text-slate-600">Free Delivery Threshold</span>
                          <span className="font-extrabold text-slate-900">
                            ₹{money(deliverySettings.deliveryChargeThresholdAmount)}
                          </span>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="text-slate-600">Delivery Rule</span>
                          <span className="font-extrabold text-slate-900">
                            {deliverySettings.deliveryChargeEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 text-[11px] font-semibold text-orange-800 leading-relaxed">
                        {deliverySettingsLoading
                          ? "Checking delivery rules..."
                          : estimatedDeliveryCharge > 0
                          ? `A delivery charge of ₹${money(
                              estimatedDeliveryCharge
                            )} is expected because the hardcopy subtotal is below the free delivery threshold.`
                          : hasPhysicalItem
                          ? deliverySettings.deliveryChargeEnabled
                            ? safeNum(estimatedHardcopySubtotalAfterDiscount, 0) > 0
                              ? `${deliverySettings.freeDeliveryLabel} applies for this hardcopy order preview.`
                              : "Delivery will be recalculated once your order amount is finalized."
                            : "Delivery charges are currently disabled."
                          : "No hardcopy delivery charge is applicable."}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3 mb-6 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                    {cart.map((item: any) => {
                      const lineTotal = safeNum(item.price, 0) * safeNum(item.quantity, 1);

                      return (
                        <div
                          key={String(item.id)}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm md:text-base font-extrabold text-slate-900 leading-snug">
                                  {safeStr(item.title) || "Untitled Item"}
                                </div>

                                {isComboCartItem(item) ? (
                                  <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-[11px] font-extrabold">
                                    Builder Combo
                                  </span>
                                ) : null}

                                {isHardcopyCartItem(item) ? (
                                  <span className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 text-[11px] font-extrabold">
                                    Hardcopy
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-1 flex flex-wrap gap-2">
                                {safeStr(item.comboMediumLabel) ? (
                                  <span className="inline-flex items-center rounded-full bg-gray-50 text-slate-700 border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold">
                                    Medium: {safeStr(item.comboMediumLabel)}
                                  </span>
                                ) : null}

                                {safeStr(item.comboSessionLabel) ? (
                                  <span className="inline-flex items-center rounded-full bg-gray-50 text-slate-700 border border-gray-200 px-2.5 py-1 text-[11px] font-extrabold">
                                    Session: {safeStr(item.comboSessionLabel)}
                                  </span>
                                ) : null}

                                {safeStr(item.comboSaveLabel) ? (
                                  <span className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 text-[11px] font-extrabold">
                                    {safeStr(item.comboSaveLabel)}
                                  </span>
                                ) : null}
                              </div>

                              {isComboCartItem(item) &&
                              Array.isArray(item.comboItems) &&
                              item.comboItems.length > 0 ? (
                                <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                                  <div className="text-[11px] uppercase font-extrabold tracking-wide text-indigo-700">
                                    Combo Items Snapshot
                                  </div>

                                  <div className="mt-2 space-y-2">
                                    {item.comboItems.slice(0, 5).map((comboItem: any, idx: number) => (
                                      <div
                                        key={`${safeStr(comboItem?.title)}-${idx}`}
                                        className="rounded-xl border border-indigo-100 bg-white px-3 py-2"
                                      >
                                        <div className="text-sm font-extrabold text-slate-900">
                                          {safeStr(comboItem?.title) || "Untitled Item"}
                                        </div>
                                        {safeStr(comboItem?.subtitle) ? (
                                          <div className="mt-0.5 text-xs font-semibold text-slate-600">
                                            {safeStr(comboItem?.subtitle)}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}

                                    {item.comboItems.length > 5 ? (
                                      <div className="text-xs font-extrabold text-indigo-700">
                                        +{item.comboItems.length - 5} more items
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-[11px] uppercase font-extrabold tracking-wide text-slate-500">
                                {isComboCartItem(item) ? "Combo Total" : "Item Total"}
                              </div>
                              <div className="mt-1 text-base md:text-lg font-extrabold text-blue-700">
                                ₹{money(lineTotal)}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-500">
                                Qty: {safeNum(item.quantity, 1)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <Info size={18} className="text-blue-700 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-900 font-semibold leading-6">
                        This checkout page shows a live preview. The final payable amount is verified by
                        the backend during order creation, including wallet adjustment, promo rules, and
                        hardcopy delivery charges.
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-4 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>₹{money(roundSafe(cartTotal))}</span>
                    </div>

                    {discount > 0 ? (
                      <div className="flex justify-between text-green-700 font-bold">
                        <span>Discount ({safeStr(appliedPromo?.code)})</span>
                        <span>-₹{money(roundSafe(discount))}</span>
                      </div>
                    ) : null}

                    {hasPhysicalItem ? (
                      <div
                        className={`flex justify-between font-bold ${
                          estimatedDeliveryCharge > 0 ? "text-orange-700" : "text-green-700"
                        }`}
                      >
                        <span>
                          {estimatedDeliveryCharge > 0
                            ? deliverySettings.deliveryChargeLabel
                            : deliverySettings.freeDeliveryLabel}
                        </span>
                        <span>
                          {estimatedDeliveryCharge > 0
                            ? `₹${money(estimatedDeliveryCharge)}`
                            : "₹0"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-slate-500 font-bold">
                        <span>Delivery</span>
                        <span>Not applicable</span>
                      </div>
                    )}

                    {hasWalletCredit ? (
                      <div className="flex justify-between text-violet-700 font-bold">
                        <span>Wallet Credit</span>
                        <span>Auto-adjusted at payment</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-between text-2xl font-extrabold text-slate-900 border-t border-gray-200 pt-4 mt-4 mb-6">
                    <span>Total</span>
                    <span>₹{money(estimatedGrandTotal)}</span>
                  </div>

                  <div className="flex gap-3 items-start mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={isAgreed}
                      onChange={(e) => setIsAgreed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <label
                      htmlFor="terms"
                      className="text-xs text-slate-500 leading-tight cursor-pointer select-none"
                    >
                      I agree to the{" "}
                      <Link href="/terms" target="_blank" className="text-blue-600 font-bold hover:underline">
                        Terms & Conditions
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="text-blue-600 font-bold hover:underline"
                      >
                        Privacy Policy
                      </Link>
                      . I understand that digital products are non-refundable.
                    </label>
                  </div>

                  <button
                    onClick={handleCompleteOrder}
                    disabled={isProcessing || promoLoading || !cartReady}
                    className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg ${
                      isProcessing || promoLoading || !cartReady
                        ? "bg-blue-400 cursor-wait"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95"
                    }`}
                  >
                    {isProcessing ? (
                      "Processing..."
                    ) : (
                      <>
                        <Lock size={18} /> Complete Order
                      </>
                    )}
                  </button>

                  <div className="mt-4 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Powered By</p>
                    <div className="text-xl font-bold text-blue-900 opacity-80">Razorpay</div>
                  </div>

                  <div className="mt-5 text-xs text-slate-600 flex items-center gap-2">
                    <ArrowLeft size={16} />
                    <Link href="/cart" className="font-bold text-blue-600 hover:underline">
                      Back to Cart
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#EFF6FF] border-t border-blue-100 py-10">
        <div className="max-w-[1000px] mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                <BadgeCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">100% Verified Content</h4>
                <p className="text-xs text-slate-500 mt-1">Assignments prepared by IGNOU toppers.</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Secure Payment</h4>
                <p className="text-xs text-slate-500 mt-1">256-bit SSL encryption via Razorpay.</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                <Headphones size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Instant Support</h4>
                <p className="text-xs text-slate-500 mt-1">WhatsApp support available for order help.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}