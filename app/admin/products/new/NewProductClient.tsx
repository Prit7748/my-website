"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Sparkles,
  Image as ImageIcon,
  IndianRupee,
  ShieldAlert,
  CheckCircle2,
  Lock,
} from "lucide-react";
import {
  CATEGORY_CONFIG as CATEGORIES,
  PHYSICAL_CATEGORY,
  deriveIsDigitalFromCategory,
  categoryLabelToSessionSlugCandidates,
  normalizeProductCategory,
} from "@/lib/productCatalog";

const BASE_LANGS = ["Hindi", "English"] as const;

type SessionItem = {
  _id?: string;
  name: string;
  slug: string;
  categories?: string[];
  isActive?: boolean;
  sortOrder?: number;
};

type SubjectItem = {
  _id?: string;
  code: string;
  titleEn?: string;
  titleHi?: string;
  otherLangName?: string;
  titleOther?: string;
  isActive?: boolean;
};

type CourseItem = {
  _id?: string;
  code: string;
  title?: string;
  isActive?: boolean;
};

type PricingPreviewResult = {
  ok: boolean;
  source: "product_override" | "course_rule" | "fallback" | "not_found";
  price: number;
  oldPrice: number;
  matchedCourseCode: string;
  matchedRuleId: string;
  matchedRuleKey: string;
  reason: string;
};

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeCode(input: string) {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeCodeKeepSpace(input: string) {
  return (input || "").toUpperCase().replace(/\s+/g, " ").trim();
}

function lang3FromLabel(langLabel: string) {
  const x = (langLabel || "").trim().toUpperCase();
  if (x.startsWith("HIN") || x === "HINDI") return "HIN";
  if (x.startsWith("ENG") || x === "ENGLISH") return "ENG";
  if (x.startsWith("SAN") || x === "SANSKRIT") return "SAN";
  const only = x.replace(/[^A-Z]/g, "");
  return (only.slice(0, 3) || "OTH").padEnd(3, "X");
}

function sessionTo6(input: string) {
  const s = (input || "").trim();
  if (!s) return "";

  if (/^\d{6}$/.test(s)) return s;

  const years4 = s.match(/\d{4}/g) || [];
  if (years4.length >= 2) {
    const y1 = years4[0];
    const y2 = years4[1];
    return `${y1}${y2.slice(-2)}`;
  }

  if (/^\d{4}$/.test(s)) {
    return `${s}00`;
  }

  const monthYear = s.match(
    /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{4})$/i
  );
  if (monthYear) {
    const monRaw = monthYear[1].toLowerCase();
    const year = monthYear[2];

    const mmMap: Record<string, string> = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      sept: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };

    const mm = mmMap[monRaw];
    if (mm) return `${year}${mm}`;
  }

  const normalized = s.toLowerCase().replace(/\s+/g, " ").trim();
  if (["latest", "new session", "new-session"].includes(normalized)) {
    return "";
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(0, 6);
  return "";
}

function splitCsv(input: string) {
  return (input || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = v.trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function isHindiLike(lang: string) {
  const x = (lang || "").trim().toLowerCase();
  return x === "hindi" || x.startsWith("hin");
}

function isEnglishLike(lang: string) {
  const x = (lang || "").trim().toLowerCase();
  return x === "english" || x.startsWith("eng");
}

function normalizeSubjectCodeLoose(input: string) {
  return (input || "").toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
}

function normalizeAvailabilityForUi(input: string) {
  const v = String(input || "").trim().toLowerCase();
  if (v === "available") return "available";
  if (
    v === "on_demand" ||
    v === "ondemand" ||
    v === "on-demand" ||
    v === "coming_soon" ||
    v === "comingsoon" ||
    v === "coming-soon"
  ) {
    return "on_demand";
  }
  if (
    v === "want_to_buy" ||
    v === "wanttobuy" ||
    v === "want-to-buy" ||
    v === "out_of_stock" ||
    v === "outofstock" ||
    v === "out-of-stock"
  ) {
    return "want_to_buy";
  }
  return "want_to_buy";
}

function availabilityLabel(input: string) {
  const v = normalizeAvailabilityForUi(input);
  if (v === "available") return "Available";
  if (v === "on_demand") return "On Demand";
  return "Want to Buy";
}

function pricingSourceLabel(source?: string) {
  if (source === "product_override") return "Product Override";
  if (source === "course_rule") return "Category + Course Rule";
  if (source === "fallback") return "Fallback";
  return "Not Found";
}

export default function NewProductClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const productId = (sp.get("id") || "").trim();
  const prefillCategory = normalizeProductCategory(sp.get("category") || "");
  const isEdit = Boolean(productId);

  const [saving, setSaving] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [isLockedAutoGeneratedHardcopy, setIsLockedAutoGeneratedHardcopy] = useState(false);
  const [loadedAvailability, setLoadedAvailability] = useState("want_to_buy");

  const [sessionMode, setSessionMode] = useState<"master" | "other">("master");
  const [languageMode, setLanguageMode] = useState<"base" | "other">("base");

  const [masterSessions, setMasterSessions] = useState<string[]>(["2025-2026"]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");

  const [subjectLookupMsg, setSubjectLookupMsg] = useState("");
  const [courseLookupMsg, setCourseLookupMsg] = useState("");

  const [pricingPreview, setPricingPreview] = useState<PricingPreviewResult | null>(null);
  const [pricingPreviewLoading, setPricingPreviewLoading] = useState(false);
  const [pricingPreviewError, setPricingPreviewError] = useState("");

  const courseTitleByNormCodeRef = useRef<Map<string, string>>(new Map());
  const subjectCacheRef = useRef<Map<string, SubjectItem>>(new Map());

  const editLoadStartedRef = useRef(false);
  const pendingEditSessionRef = useRef<string>("");
  const sessionFetchSeqRef = useRef(0);
  const subjectReqSeqRef = useRef(0);
  const courseReqSeqRef = useRef(0);
  const pricingReqSeqRef = useRef(0);
  const isHydratingEditRef = useRef(false);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    category: prefillCategory && prefillCategory !== PHYSICAL_CATEGORY ? prefillCategory : "Solved Assignments",

    subjectCode: "",
    subjectTitleHi: "",
    subjectTitleEn: "",
    subjectTitleOther: "",

    courseCodes: "",
    courseTitles: "",

    session: "2025-2026",
    sessionOther: "",

    language: "Hindi",
    languageOther: "",

    pages: "",
    importantNote:
      "Please verify the question paper shown in the preview/thumbnail before purchasing. Purchase only if it matches your subject code, medium, session, and questions.",

    deliverWithinMinutes: "20",
    onDemandNote: "",
    autoMakeAvailableOnUpload: true,

    shortDesc: "",
    descriptionHtml: "",

    pdfKey: "",

    imagesText: "",
    isActive: false,

    sku: "",
    metaTitle: "",
    metaDescription: "",
  });

  const addableCategories = useMemo(
    () => CATEGORIES.filter((c) => c.label !== PHYSICAL_CATEGORY),
    []
  );

  const categoryOptions = useMemo(() => {
    if (isEdit && form.category === PHYSICAL_CATEGORY) return CATEGORIES;
    return addableCategories;
  }, [isEdit, form.category, addableCategories]);

  const selectedSession = useMemo(() => {
    return sessionMode === "master" ? form.session : form.sessionOther;
  }, [sessionMode, form.session, form.sessionOther]);

  const selectedLanguage = useMemo(() => {
    return languageMode === "base" ? form.language : form.languageOther;
  }, [languageMode, form.language, form.languageOther]);

  const selectedCat = useMemo(
    () =>
      categoryOptions.find((c) => c.label === form.category) ||
      CATEGORIES.find((c) => c.label === form.category) ||
      addableCategories[0],
    [form.category, categoryOptions, addableCategories]
  );

  const isPhysicalProduct = useMemo(() => form.category === PHYSICAL_CATEGORY, [form.category]);
  const isDigitalProduct = useMemo(() => deriveIsDigitalFromCategory(form.category), [form.category]);

  const normalizedSubject = useMemo(() => normalizeCode(form.subjectCode), [form.subjectCode]);
  const sess6 = useMemo(() => sessionTo6(selectedSession), [selectedSession]);
  const l3 = useMemo(() => lang3FromLabel(selectedLanguage), [selectedLanguage]);

  const suggestedSKU = useMemo(() => {
    const code = normalizedSubject || "CODE";
    const suf = selectedCat?.skuSuffix || "A";
    const sessionRaw = (selectedSession || "").trim();
    const sessionLower = sessionRaw.toLowerCase().replace(/\s+/g, " ").trim();

    if (suf === "Q") {
      const m = sessionRaw.match(
        /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{4})$/i
      );

      if (m) {
        const mon = m[1].toLowerCase();
        const yy = m[2].slice(-2);

        const mon3Map: Record<string, string> = {
          jan: "JAN",
          january: "JAN",
          feb: "FEB",
          february: "FEB",
          mar: "MAR",
          march: "MAR",
          apr: "APR",
          april: "APR",
          may: "MAY",
          jun: "JUN",
          june: "JUN",
          jul: "JUL",
          july: "JUL",
          aug: "AUG",
          august: "AUG",
          sep: "SEP",
          sept: "SEP",
          september: "SEP",
          oct: "OCT",
          october: "OCT",
          nov: "NOV",
          november: "NOV",
          dec: "DEC",
          december: "DEC",
        };

        const mon3 = mon3Map[mon] || "SES";
        return `${code}${l3}${mon3}${yy}${suf}`.slice(0, 40);
      }

      if (sessionLower === "latest" || sessionLower === "new session" || sessionLower === "new-session") {
        return `${code}${l3}LATEST${suf}`.slice(0, 40);
      }
    }

    return `${code}${l3}${sess6 || ""}${suf}`.slice(0, 40);
  }, [normalizedSubject, l3, selectedSession, selectedCat, sess6]);

  const suggestedSlug = useMemo(() => {
    const code = normalizedSubject || "product";
    const sess = (selectedSession || "").trim();
    const lang = isHindiLike(selectedLanguage) ? "hindi" : isEnglishLike(selectedLanguage) ? "english" : "other";
    const core = ["ignou", code, selectedCat?.slugKey || "product", sess, lang].filter(Boolean).join(" ");
    return slugify(core);
  }, [normalizedSubject, selectedSession, selectedLanguage, selectedCat]);

  const suggestedMetaTitle = useMemo(() => {
    const code = normalizedSubject || "PRODUCT";
    const sess = (selectedSession || "").trim();
    const lang = isHindiLike(selectedLanguage) ? "Hindi" : isEnglishLike(selectedLanguage) ? "English" : selectedLanguage || "Other";
    const cat = form.category;
    return `IGNOU ${code} ${cat} ${sess} (${lang}) – Download PDF`;
  }, [normalizedSubject, selectedSession, selectedLanguage, form.category]);

  const suggestedMetaDesc = useMemo(() => {
    const code = normalizedSubject || "product";
    const sess = (selectedSession || "").trim();
    const lang = isHindiLike(selectedLanguage) ? "Hindi" : isEnglishLike(selectedLanguage) ? "English" : selectedLanguage || "Other";
    return `Download IGNOU ${code} ${form.category} for session ${sess} (${lang}). Verified content, instant access, and clear formatting.`;
  }, [normalizedSubject, selectedSession, selectedLanguage, form.category]);

  const imagesArray = useMemo(() => {
    return (form.imagesText || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }, [form.imagesText]);

  const activeSubjectTitle = useMemo(() => {
    if (languageMode === "other" && form.subjectTitleOther) return form.subjectTitleOther.trim();
    return isHindiLike(selectedLanguage) ? form.subjectTitleHi.trim() : form.subjectTitleEn.trim();
  }, [selectedLanguage, form.subjectTitleHi, form.subjectTitleEn, languageMode, form.subjectTitleOther]);

  const derivedAvailabilityText = useMemo(() => {
    if (form.pdfKey.trim()) return "Available";
    if (isEdit) return availabilityLabel(loadedAvailability);
    return "Auto Derived After Save";
  }, [form.pdfKey, isEdit, loadedAvailability]);

  function applyAutoFill() {
    setForm((p) => ({
      ...p,
      slug: p.slug || suggestedSlug,
      sku: p.sku || suggestedSKU,
      metaTitle: p.metaTitle || suggestedMetaTitle,
      metaDescription: p.metaDescription || suggestedMetaDesc,
    }));
  }

  async function fetchSessionsForCategory(categoryLabel: string): Promise<string[]> {
    const reqId = ++sessionFetchSeqRef.current;
    setSessionsLoading(true);
    setSessionsError("");

    try {
      const res = await fetch("/api/admin/sessions?limit=200", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load sessions");

      if (reqId !== sessionFetchSeqRef.current) return [];

      const items: SessionItem[] = Array.isArray(data?.items) ? data.items : [];
      const catCandidates = categoryLabelToSessionSlugCandidates(categoryLabel).map((x) => String(x).trim());

      const filtered = items.filter((s) => {
        if (s?.isActive === false) return false;

        const cats = Array.isArray(s?.categories) ? s.categories : [];
        if (!cats.length) return true;

        const normalizedSessionCats = cats.map((c) => String(c || "").trim()).filter(Boolean);

        return normalizedSessionCats.some((c) => {
          const cTrim = c.trim();
          const cLower = cTrim.toLowerCase();
          const cSlug = slugify(cTrim);

          return catCandidates.some((cc) => {
            const ccTrim = String(cc || "").trim();
            return ccTrim === cTrim || ccTrim === cLower || ccTrim === cSlug;
          });
        });
      });

      const names = uniqueStrings(filtered.map((s) => String(s?.name || "").trim()).filter(Boolean));

      if (reqId !== sessionFetchSeqRef.current) return [];

      if (names.length) {
        setMasterSessions(names);

        setForm((p) => {
          if (isHydratingEditRef.current) return p;
          const current = p.session;
          const nextSession = names.includes(current) ? current : names[0];
          return current === nextSession ? p : { ...p, session: nextSession };
        });
      } else {
        setMasterSessions([]);
        setSessionsError("No active sessions found for selected category.");
      }

      return names;
    } catch (e: any) {
      if (reqId === sessionFetchSeqRef.current) {
        setSessionsError(e?.message || "Failed to load sessions");
        setMasterSessions([]);
      }
      return [];
    } finally {
      if (reqId === sessionFetchSeqRef.current) {
        setSessionsLoading(false);
      }
    }
  }

  async function autoFillSubjectFromMaster(subjectCodeInput: string, languageInput: string) {
    const codeRaw = String(subjectCodeInput || "").trim();
    if (!codeRaw) {
      setSubjectLookupMsg("");
      return;
    }

    const reqId = ++subjectReqSeqRef.current;

    const codeSpaced = normalizeCodeKeepSpace(codeRaw) || codeRaw;
    const codeTight = normalizeSubjectCodeLoose(codeRaw);
    const cacheKey = codeTight;

    let item = subjectCacheRef.current.get(cacheKey);

    try {
      if (!item) {
        const queries = uniqueStrings([codeSpaced, codeTight].filter(Boolean));
        let found: SubjectItem | null = null;

        for (const q of queries) {
          const res = await fetch(`/api/admin/subjects?q=${encodeURIComponent(q)}&limit=50`, {
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Subject lookup failed");

          if (reqId !== subjectReqSeqRef.current) return;

          const items: SubjectItem[] = Array.isArray(data?.items) ? data.items : [];

          found =
            items.find((s) => normalizeSubjectCodeLoose(String(s?.code || "")) === cacheKey) ||
            items.find((s) => normalizeSubjectCodeLoose(String(s?.code || "")).includes(cacheKey)) ||
            items.find((s) => cacheKey.includes(normalizeSubjectCodeLoose(String(s?.code || "")))) ||
            null;

          if (found) break;
        }

        if (found) {
          item = found;
          subjectCacheRef.current.set(cacheKey, found);
        }
      }

      if (reqId !== subjectReqSeqRef.current) return;

      if (!item) {
        setSubjectLookupMsg("Subject not found in master subjects.");
        return;
      }

      setForm((p) => {
        const next = {
          ...p,
          subjectTitleHi: String(item?.titleHi || p.subjectTitleHi || "").trim(),
          subjectTitleEn: String(item?.titleEn || p.subjectTitleEn || "").trim(),
        };

        if (languageMode === "other") {
          const selectedOtherLang = (languageInput || "").trim().toLowerCase();
          const masterOtherLang = String(item?.otherLangName || "").trim().toLowerCase();
          if (selectedOtherLang && masterOtherLang && selectedOtherLang === masterOtherLang) {
            next.subjectTitleOther = String(item?.titleOther || "").trim();
          }
        }

        return next;
      });

      const langMsg = isHindiLike(languageInput)
        ? item?.titleHi
          ? "Subject auto-filled (Hindi title found)."
          : "Subject found, but Hindi title missing in master subjects."
        : isEnglishLike(languageInput)
        ? item?.titleEn
          ? "Subject auto-filled (English title found)."
          : "Subject found, but English title missing in master subjects."
        : "Subject found. Titles synced from master subjects.";

      setSubjectLookupMsg(langMsg);
    } catch (e: any) {
      if (reqId !== subjectReqSeqRef.current) return;
      setSubjectLookupMsg(e?.message || "Subject lookup failed");
    }
  }

  async function autoFillCourseTitlesFromMaster(courseCodesInput: string) {
    const rawCodes = uniqueStrings(splitCsv(courseCodesInput).map((x) => x.toUpperCase()));
    if (!rawCodes.length) {
      setCourseLookupMsg("");
      setForm((p) => ({ ...p, courseTitles: "" }));
      return;
    }

    const reqId = ++courseReqSeqRef.current;

    try {
      if (courseTitleByNormCodeRef.current.size === 0) {
        const res = await fetch("/api/admin/courses?limit=200", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Course lookup failed");

        if (reqId !== courseReqSeqRef.current) return;

        const items: CourseItem[] = Array.isArray(data?.items) ? data.items : [];
        const map = new Map<string, string>();

        for (const c of items) {
          if (c?.isActive === false) continue;
          const k = normalizeSubjectCodeLoose(String(c?.code || ""));
          const v = String(c?.title || "").trim();
          if (k && v && !map.has(k)) map.set(k, v);
        }

        courseTitleByNormCodeRef.current = map;
      }

      if (reqId !== courseReqSeqRef.current) return;

      const titles: string[] = [];
      const missing: string[] = [];

      for (const code of rawCodes) {
        const norm = normalizeSubjectCodeLoose(code);
        const title = courseTitleByNormCodeRef.current.get(norm);
        if (title) titles.push(title);
        else missing.push(code);
      }

      setForm((p) => ({ ...p, courseTitles: titles.join(", ") }));

      if (!missing.length) {
        setCourseLookupMsg(`Course titles auto-filled ✅ (${titles.length})`);
      } else {
        setCourseLookupMsg(
          `Course titles auto-filled partially ✅ Found ${titles.length}, missing ${missing.length}: ${missing.join(", ")}`
        );
      }
    } catch (e: any) {
      if (reqId !== courseReqSeqRef.current) return;
      setCourseLookupMsg(e?.message || "Course lookup failed");
    }
  }

  async function refreshPricingPreview() {
    const reqId = ++pricingReqSeqRef.current;

    const category = normalizeProductCategory(form.category);
    const courseCodes = splitCsv(form.courseCodes);
    const skuToUse = (form.sku || suggestedSKU).trim();

    if (!category) {
      setPricingPreview(null);
      setPricingPreviewError("");
      return;
    }

    if (!skuToUse && !courseCodes.length) {
      setPricingPreview(null);
      setPricingPreviewError("SKU ya course code ke bina pricing preview possible nahi hai.");
      return;
    }

    setPricingPreviewLoading(true);
    setPricingPreviewError("");

    try {
      const qs = new URLSearchParams();
      qs.set("mode", "preview");
      qs.set("category", category);
      if (courseCodes.length) qs.set("courseCodes", courseCodes.join(", "));
      if (isEdit && productId) qs.set("productId", productId);
      if (skuToUse) qs.set("productSku", skuToUse);

      const res = await fetch(`/api/admin/product-pricing?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();

      if (reqId !== pricingReqSeqRef.current) return;

      if (!res.ok || !data?.ok) {
        setPricingPreview(null);
        setPricingPreviewError(data?.error || "Pricing preview failed");
        return;
      }

      const preview = data?.preview as PricingPreviewResult;
      setPricingPreview(preview || null);

      if (!preview?.ok) {
        setPricingPreviewError(
          preview?.reason || "Pricing rule not found. Pehle Product Pricing page me rule banao."
        );
      } else {
        setPricingPreviewError("");
      }
    } catch (e: any) {
      if (reqId !== pricingReqSeqRef.current) return;
      setPricingPreview(null);
      setPricingPreviewError(e?.message || "Pricing preview failed");
    } finally {
      if (reqId === pricingReqSeqRef.current) {
        setPricingPreviewLoading(false);
      }
    }
  }

  useEffect(() => {
    fetchSessionsForCategory(form.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category]);

  useEffect(() => {
    const wanted = (pendingEditSessionRef.current || "").trim();
    if (!wanted) return;

    if (masterSessions.includes(wanted)) {
      setSessionMode("master");
      setForm((p) => ({ ...p, session: wanted, sessionOther: "" }));
    } else {
      setSessionMode("other");
      setForm((p) => ({ ...p, session: p.session || masterSessions[0] || "2025-2026", sessionOther: wanted }));
    }

    pendingEditSessionRef.current = "";
  }, [masterSessions]);

  useEffect(() => {
    if (loadingProduct || isHydratingEditRef.current) return;

    const code = form.subjectCode.trim();
    const lang = selectedLanguage.trim();
    if (!code || !lang) return;

    const t = setTimeout(() => {
      autoFillSubjectFromMaster(code, lang);
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.subjectCode, selectedLanguage, languageMode, loadingProduct]);

  useEffect(() => {
    if (loadingProduct || isHydratingEditRef.current) return;

    const t = setTimeout(() => {
      autoFillCourseTitlesFromMaster(form.courseCodes);
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.courseCodes, loadingProduct]);

  useEffect(() => {
    if (loadingProduct || isHydratingEditRef.current) return;

    const t = setTimeout(() => {
      refreshPricingPreview();
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category, form.courseCodes, form.sku, suggestedSKU, productId, isEdit, loadingProduct]);

  useEffect(() => {
    if (!isEdit || !productId) return;
    if (editLoadStartedRef.current) return;

    editLoadStartedRef.current = true;

    (async () => {
      setLoadingProduct(true);
      isHydratingEditRef.current = true;

      try {
        const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data?.error || "Failed to load product");
          return;
        }

        const p = data?.product;
        if (!p?._id) {
          alert("Product data missing");
          return;
        }

        setIsLockedAutoGeneratedHardcopy(Boolean(p.isLockedAutoGeneratedHardcopy));
        setLoadedAvailability(normalizeAvailabilityForUi(String(p.availability || "want_to_buy")));

        const lang = String(p.language || "");
        const isBaseLang = (BASE_LANGS as readonly string[]).includes(lang);
        const sess = String(p.session || "").trim();

        pendingEditSessionRef.current = sess;

        setLanguageMode(isBaseLang ? "base" : "other");

        setForm((prev) => ({
          ...prev,
          title: String(p.title || ""),
          slug: String(p.slug || ""),
          category: normalizeProductCategory(String(p.category || "Solved Assignments")),

          subjectCode: String(p.subjectCode || ""),
          subjectTitleHi: String(p.subjectTitleHi || ""),
          subjectTitleEn: String(p.subjectTitleEn || ""),
          subjectTitleOther: String(p.subjectTitleOther || ""),

          courseCodes: Array.isArray(p.courseCodes) ? p.courseCodes.join(", ") : "",
          courseTitles: Array.isArray(p.courseTitles) ? p.courseTitles.join(", ") : "",

          session: sess || prev.session,
          sessionOther: "",

          language: isBaseLang ? lang : prev.language,
          languageOther: isBaseLang ? "" : lang,

          pages: String(p.pages ?? ""),
          importantNote: String(p.importantNote || prev.importantNote),

          deliverWithinMinutes: String(p.deliverWithinMinutes ?? prev.deliverWithinMinutes),
          onDemandNote: String(p.onDemandNote || p.comingSoonNote || ""),
          autoMakeAvailableOnUpload: Boolean(p.autoMakeAvailableOnUpload ?? true),

          shortDesc: String(p.shortDesc || ""),
          descriptionHtml: String(p.descriptionHtml || ""),

          pdfKey: String(p.pdfKey || ""),

          imagesText: Array.isArray(p.images) ? p.images.join("\n") : "",
          isActive: Boolean(p.isActive ?? false),

          sku: String(p.sku || ""),
          metaTitle: String(p.metaTitle || ""),
          metaDescription: String(p.metaDescription || ""),
        }));

        const names = await fetchSessionsForCategory(String(p.category || "Solved Assignments"));
        if (pendingEditSessionRef.current) {
          const wanted = pendingEditSessionRef.current;
          if (names.includes(wanted)) {
            setSessionMode("master");
            setForm((curr) => ({ ...curr, session: wanted, sessionOther: "" }));
          } else {
            setSessionMode("other");
            setForm((curr) => ({
              ...curr,
              session: curr.session || names[0] || "2025-2026",
              sessionOther: wanted,
            }));
          }
          pendingEditSessionRef.current = "";
        }
      } catch (e: any) {
        alert(e?.message || "Load failed");
      } finally {
        isHydratingEditRef.current = false;
        setLoadingProduct(false);
      }
    })();
  }, [isEdit, productId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (isLockedAutoGeneratedHardcopy) {
      return alert("Ye auto-generated Handwritten Hardcopy product hai. Isko source Solved Assignment se hi manage karo.");
    }

    if (!isEdit && normalizeProductCategory(form.category) === PHYSICAL_CATEGORY) {
      return alert("Handwritten Hardcopy (Delivery) manual create disabled hai. Ye category ab automation se generate hogi.");
    }

    if (!form.title.trim()) return alert("Title required hai.");
    if (!form.category) return alert("Category required hai.");
    if (!form.subjectCode.trim()) return alert("Subject Code required hai.");

    if (!selectedSession.trim()) return alert("Session required hai.");

    const sessionRaw = selectedSession.trim();
    const sessionOk =
      /^\d{4}(-\d{2}|\-\d{4})?$/.test(sessionRaw) ||
      /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{4}$/i.test(sessionRaw) ||
      /^(latest|new session)$/i.test(sessionRaw);

    if (!sessionOk) {
      return alert("Session format galat hai. Examples: 2025-2026, 2026, July 2024, Latest");
    }

    if (pricingPreviewLoading) {
      return alert("Pricing preview abhi load ho rahi hai. Thoda sa ruk kar dobara save karo.");
    }

    if (!pricingPreview?.ok || Number(pricingPreview?.price || 0) <= 0) {
      return alert("Valid pricing rule nahi mila. Pehle Product Pricing page me rule set karo, phir save karo.");
    }

    const skuFinal = (form.sku || suggestedSKU).trim();
    if (!skuFinal) return alert("Unique ID / SKU required hai.");

    const payload = {
      title: form.title.trim(),
      slug: (form.slug || suggestedSlug).trim(),
      sku: skuFinal,
      category: normalizeProductCategory(form.category),

      subjectCode: form.subjectCode.trim(),
      subjectTitleHi: form.subjectTitleHi || "",
      subjectTitleEn: form.subjectTitleEn || "",
      subjectTitleOther: form.subjectTitleOther || "",

      courseCodes: splitCsv(form.courseCodes),
      courseTitles: splitCsv(form.courseTitles),

      session: selectedSession.trim(),
      session6: sess6,
      language: selectedLanguage.trim(),
      lang3: l3,

      pages: Number(form.pages || 0),
      importantNote: form.importantNote || "",

      deliverWithinMinutes: Number(form.deliverWithinMinutes || 20),
      onDemandNote: String(form.onDemandNote || ""),
      autoMakeAvailableOnUpload: Boolean(form.autoMakeAvailableOnUpload),

      shortDesc: form.shortDesc || "",
      descriptionHtml: form.descriptionHtml || "",

      metaTitle: form.metaTitle || suggestedMetaTitle,
      metaDescription: form.metaDescription || suggestedMetaDesc,

      isActive: Boolean(form.isActive),
    };

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/products/${encodeURIComponent(productId)}`
        : "/api/admin/products";

      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Failed to save product");
        return;
      }

      alert(isEdit ? "Product updated ✅" : "Product saved ✅");
      router.push("/admin/products");
      router.refresh();
    } catch (err: any) {
      alert("Server error: " + (err?.message || "unknown"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold">{isEdit ? "Edit Product" : "Add New Product"}</h1>
              <div className="text-sm text-slate-600 mt-1">
                {isEdit
                  ? "Edit mode: product auto-load ho raha hai."
                  : "Session dropdown + Subject/Course auto-fill + automation-ready product creation."}
              </div>
              {prefillCategory && !isEdit && prefillCategory !== PHYSICAL_CATEGORY && (
                <p className="text-sm text-blue-600 font-semibold mt-1">Prefilled Category: {prefillCategory}</p>
              )}
              {loadingProduct && <div className="text-xs text-slate-500 mt-2">Loading product...</div>}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>

              <button
                type="button"
                onClick={applyAutoFill}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition font-bold shadow-sm"
              >
                <Sparkles size={18} />
                Auto-fill SEO/SKU
              </button>
            </div>
          </div>

          {isLockedAutoGeneratedHardcopy ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3 text-amber-900">
                <Lock size={18} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-extrabold">Auto-generated hardcopy product</div>
                  <div className="text-sm mt-1 leading-6">
                    Ye product system ne Solved Assignment source se generate kiya hai.
                    Isko manual edit nahi karna hai. Source Solved Assignment product ko update karo.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!isEdit ? (
            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              Handwritten Hardcopy (Delivery) category manual add form se hata di gayi hai.
              Ye category ab sirf eligible Solved Assignments se automatically generate hogi.
            </div>
          ) : null}

          <form onSubmit={handleSave} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-gray-200 p-5 bg-gray-50">
                <div className="text-sm font-extrabold mb-3">Core Details</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Title</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder="IGNOU BHIC-109 Solved Assignment 2025-2026 (Hindi)"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                      Category (Single)
                    </label>
                    <select
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: normalizeProductCategory(e.target.value) }))}
                      disabled={isLockedAutoGeneratedHardcopy}
                    >
                      {categoryOptions.map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-slate-500 mt-1">
                      SKU last letter: <b>{selectedCat?.skuSuffix || "A"}</b>
                    </div>
                    <div className="text-[11px] mt-1 text-slate-600">
                      Product type:{" "}
                      <b>{isPhysicalProduct ? "Physical / Deliverable Product" : "Digital Product"}</b>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                      Unique ID (SKU, max 40)
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder={suggestedSKU}
                      value={form.sku}
                      onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value.toUpperCase() }))}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Suggested: <b>{suggestedSKU}</b>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                      Subject Code (single)
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="BHIC 109"
                      value={form.subjectCode}
                      onChange={(e) => setForm((p) => ({ ...p, subjectCode: e.target.value.toUpperCase() }))}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Normalized: <b>{normalizedSubject || "—"}</b>
                    </div>
                    {subjectLookupMsg && (
                      <div className="text-[11px] mt-1 text-slate-600">{subjectLookupMsg}</div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Session</label>

                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSessionMode("master");
                          setForm((p) => ({ ...p, sessionOther: "" }));
                        }}
                        className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                          sessionMode === "master"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Master
                      </button>

                      <button
                        type="button"
                        onClick={() => setSessionMode("other")}
                        className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                          sessionMode === "other"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Other
                      </button>
                    </div>

                    {sessionMode === "master" ? (
                      <select
                        className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                        value={form.session}
                        onChange={(e) => setForm((p) => ({ ...p, session: e.target.value }))}
                        disabled={sessionsLoading}
                      >
                        {sessionsLoading ? (
                          <option value="">Loading sessions...</option>
                        ) : masterSessions.length ? (
                          masterSessions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))
                        ) : (
                          <option value="">No session found</option>
                        )}
                      </select>
                    ) : (
                      <input
                        className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                        placeholder="e.g. 2025-2026 / July 2024 / Latest"
                        value={form.sessionOther}
                        onChange={(e) => setForm((p) => ({ ...p, sessionOther: e.target.value }))}
                      />
                    )}

                    <div className="text-[11px] text-slate-500 mt-1">
                      Session6: <b>{sess6 || "—"}</b>
                    </div>
                    {sessionsError && (
                      <div className="text-[11px] mt-1 text-rose-600">{sessionsError}</div>
                    )}
                    {!sessionsError && sessionMode === "master" && (
                      <div className="text-[11px] mt-1 text-slate-500">
                        Sessions are loaded from Sessions master page (category-wise).
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Language</label>

                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLanguageMode("base");
                          setForm((p) => ({ ...p, languageOther: "", subjectTitleOther: "" }));
                        }}
                        className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                          languageMode === "base"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Hindi/English
                      </button>

                      <button
                        type="button"
                        onClick={() => setLanguageMode("other")}
                        className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                          languageMode === "other"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Other
                      </button>
                    </div>

                    {languageMode === "base" ? (
                      <select
                        className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                        value={form.language}
                        onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
                      >
                        {BASE_LANGS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                        placeholder="e.g. Sanskrit / Bengali / Marathi / Tamil / Urdu / Malayalam"
                        value={form.languageOther}
                        onChange={(e) => setForm((p) => ({ ...p, languageOther: e.target.value }))}
                      />
                    )}

                    <div className="text-[11px] text-slate-500 mt-1">
                      Lang3: <b>{l3}</b> (SKU uses this)
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">No. of Pages</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="e.g. 60"
                      value={form.pages}
                      onChange={(e) => setForm((p) => ({ ...p, pages: e.target.value }))}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Solved PDF upload hone par pages auto-sync bhi ho sakte hain.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Subject Title (Hindi)</label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="भारत का इतिहास -V (c.1550-1605)"
                      value={form.subjectTitleHi}
                      onChange={(e) => setForm((p) => ({ ...p, subjectTitleHi: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Subject Title (English)</label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="History of India-V (c.1550-1605)"
                      value={form.subjectTitleEn}
                      onChange={(e) => setForm((p) => ({ ...p, subjectTitleEn: e.target.value }))}
                    />
                  </div>
                </div>

                {languageMode === "other" && (
                  <div className="mt-3">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                      Subject Title (Other Language)
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                      placeholder="e.g. संस्कृत / تاریخ"
                      value={form.subjectTitleOther}
                      onChange={(e) => setForm((p) => ({ ...p, subjectTitleOther: e.target.value }))}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Note: This will be saved as the additional vernacular title.
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-500 mt-2">
                  Current active title (based on language): <b>{activeSubjectTitle || "—"}</b>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 mt-4">
                  <div className="text-sm font-extrabold">Course Mapping (for filters)</div>

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-3 block">
                    Course Code(s) (comma separated)
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                    placeholder="BAHIH, BAG"
                    value={form.courseCodes}
                    onChange={(e) => setForm((p) => ({ ...p, courseCodes: e.target.value.toUpperCase() }))}
                  />

                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-3 block">
                    Course Title(s) (auto-fill, comma separated same order)
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-blue-500 transition font-medium"
                    placeholder="Bachelor of Arts (Honours) History (BAHIH), Bachelor of Arts (General) (BAG)"
                    value={form.courseTitles}
                    onChange={(e) => setForm((p) => ({ ...p, courseTitles: e.target.value }))}
                  />

                  <div className="text-[11px] text-slate-500 mt-2">
                    Parsed codes: <b>{splitCsv(form.courseCodes).join(", ") || "—"}</b>
                  </div>
                  {courseLookupMsg && (
                    <div className="text-[11px] text-slate-600 mt-1">{courseLookupMsg}</div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-sm font-extrabold text-emerald-900">Availability Automation</div>
                    <div className="text-sm text-emerald-800 mt-2 leading-6">
                      Manual availability selector remove kar diya gaya hai.
                      <br />
                      System ab SKU/file-existence ke basis par auto decide karega:
                      <br />
                      <b>Solved PDF → Available</b>
                      <br />
                      <b>Official Paper only → On Demand</b>
                      <br />
                      <b>No file → Want to Buy</b>
                    </div>
                    <div className="mt-3 text-xs text-emerald-900">
                      Current status: <b>{derivedAvailabilityText}</b>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-extrabold">
                      <IndianRupee size={18} />
                      Auto Pricing Preview
                    </div>

                    <div className="text-xs text-slate-500 mt-2 leading-5">
                      Manual price fields remove kar diye gaye hain. Final price Product Pricing rules se auto resolve hoga.
                    </div>

                    {pricingPreviewLoading ? (
                      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                        Pricing preview load ho rahi hai...
                      </div>
                    ) : pricingPreview?.ok ? (
                      <div className="mt-3">
                        <div className="text-2xl font-extrabold text-slate-900">
                          ₹{Number(pricingPreview.price || 0)}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Source: <b>{pricingSourceLabel(pricingPreview.source)}</b>
                        </div>
                        {Number(pricingPreview.oldPrice || 0) > 0 ? (
                          <div className="text-xs text-slate-600 mt-1">
                            Old Price: <b>₹{Number(pricingPreview.oldPrice || 0)}</b>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                        <div className="flex items-start gap-2">
                          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                          <div>
                            <div className="font-bold">Pricing rule not found</div>
                            <div className="mt-1">
                              {pricingPreviewError || "Pehle Product Pricing page me rule set karo."}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-extrabold text-amber-900">On Demand Default Settings</div>

                  <div className="text-xs text-amber-800 mt-2 leading-5">
                    Ye values tab use hongi jab system kisi product ko auto <b>On Demand</b> classify karega.
                  </div>

                  <label className="text-xs font-bold text-slate-600 uppercase ml-1 mt-3 block">
                    Deliver Within (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-amber-200 bg-white outline-none focus:border-amber-500 transition font-medium"
                    placeholder="20"
                    value={form.deliverWithinMinutes}
                    onChange={(e) => setForm((p) => ({ ...p, deliverWithinMinutes: e.target.value }))}
                  />

                  <label className="text-xs font-bold text-slate-600 uppercase ml-1 mt-3 block">
                    Trust Note (optional)
                  </label>
                  <textarea
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-amber-200 bg-white outline-none focus:border-amber-500 transition font-medium min-h-[90px]"
                    placeholder="Example: Your material will be uploaded and available in your dashboard shortly after purchase."
                    value={form.onDemandNote}
                    onChange={(e) => setForm((p) => ({ ...p, onDemandNote: e.target.value }))}
                  />

                  <div className="flex items-center gap-3 mt-3">
                    <input
                      type="checkbox"
                      checked={form.autoMakeAvailableOnUpload}
                      onChange={(e) => setForm((p) => ({ ...p, autoMakeAvailableOnUpload: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    <div className="font-bold">
                      Auto switch to <span className="underline">Available</span> after solved PDF upload
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Important Note</label>
                  <textarea
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium min-h-[100px]"
                    value={form.importantNote}
                    onChange={(e) => setForm((p) => ({ ...p, importantNote: e.target.value }))}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-5 bg-white">
                <div className="text-sm font-extrabold mb-3">Descriptions</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Short Description</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium min-h-[80px]"
                  value={form.shortDesc}
                  onChange={(e) => setForm((p) => ({ ...p, shortDesc: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Long Description
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium min-h-[140px]"
                  value={form.descriptionHtml}
                  onChange={(e) => setForm((p) => ({ ...p, descriptionHtml: e.target.value }))}
                />
              </div>

              <div className="rounded-2xl border border-gray-200 p-5 bg-gray-50">
                <div className="text-sm font-extrabold mb-3">Product Type + Images</div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-extrabold text-slate-900">Product Type</div>
                  <div className="text-sm text-slate-700 mt-2 leading-6">
                    Category ke basis par product type automatic set hoga.
                    <br />
                    <b>Handwritten Hardcopy (Delivery)</b> = Physical Product
                    <br />
                    Baki sab categories = Digital Product
                  </div>
                </div>

                {isDigitalProduct && (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="text-sm font-extrabold text-blue-900">Solved PDF Management</div>
                    <div className="text-sm text-blue-800 mt-2 leading-6">
                      Direct PDF upload yahan se band kar diya gaya hai.
                      <br />
                      Product PDF sirf <b>PDF Vault / Lalita</b> se SKU filename ke basis par link hogi.
                    </div>
                  </div>
                )}

                {isPhysicalProduct && (
                  <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <div className="text-sm font-extrabold text-orange-900">Physical Delivery Product</div>
                    <div className="text-sm text-orange-800 mt-2 leading-6">
                      Ye category manual upload ke liye deprecated hai.
                      <br />
                      Naye hardcopy products ab source solved assignments se auto-generate honge.
                    </div>
                  </div>
                )}

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Linked Solved PDF Key (read only)
                </label>
                <input
                  readOnly
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-slate-50 outline-none font-medium"
                  placeholder="Vault upload ke baad auto fill / existing linked key"
                  value={form.pdfKey}
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Naye products ke liye direct PDF mat bharo. Vault me same SKU naam se solved PDF upload karo.
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-extrabold text-emerald-900">Product Images (Bulk Managed)</div>
                  <div className="text-sm text-emerald-800 mt-2 leading-6">
                    Single product page se image upload hata diya gaya hai.
                    <br />
                    Product images sirf <b>Bulk Product Images</b> page se manage hongi aur yahan auto preview me dikhengi.
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 block">
                    Attached Product Images Preview
                  </label>

                  {imagesArray.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {imagesArray.map((url, idx) => (
                        <a
                          key={`${url}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group"
                          title={`Image ${idx + 1}`}
                        >
                          <div className="h-16 w-16 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                            <img
                              src={url}
                              alt={`Product image ${idx + 1}`}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-slate-500 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <ImageIcon size={18} />
                      </div>
                      <div>
                        Abhi koi product image attached nahi hai.
                        <div className="text-xs text-slate-400 mt-1">
                          Bulk Product Images page se same product SKU ke andar images upload karne par yahan preview dikh jayega.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 mt-2">
                    Total linked images: <b>{imagesArray.length}</b>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="h-4 w-4"
                    disabled={isLockedAutoGeneratedHardcopy}
                  />
                  <div className="font-bold">
                    Publish now{" "}
                    <span className="text-xs text-slate-500 font-semibold">(Draft recommended)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 p-5 bg-white">
                <div className="text-sm font-extrabold mb-3">SEO</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Slug</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder={suggestedSlug}
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: slugify(e.target.value) }))}
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Suggested: <b>{suggestedSlug}</b>
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Meta Title
                </label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium"
                  placeholder={suggestedMetaTitle}
                  value={form.metaTitle}
                  onChange={(e) => setForm((p) => ({ ...p, metaTitle: e.target.value }))}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Meta Description
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-blue-500 transition font-medium min-h-[110px]"
                  placeholder={suggestedMetaDesc}
                  value={form.metaDescription}
                  onChange={(e) => setForm((p) => ({ ...p, metaDescription: e.target.value }))}
                />

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-bold text-slate-500 uppercase">Google Preview</div>
                  <div className="mt-2 text-blue-700 font-bold text-sm line-clamp-2">
                    {form.metaTitle || suggestedMetaTitle}
                  </div>
                  <div className="text-xs text-emerald-700 mt-1">
                    https://istudentsportal.com/product/{form.slug || suggestedSlug}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 line-clamp-3">
                    {form.metaDescription || suggestedMetaDesc}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">Save Readiness</div>

                {isLockedAutoGeneratedHardcopy ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Ye auto-generated hardcopy product locked hai.
                  </div>
                ) : pricingPreview?.ok ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                      <div>
                        Pricing rule matched hai. Product save ho sakta hai.
                        <div className="text-xs mt-1">
                          Final auto price: <b>₹{Number(pricingPreview.price || 0)}</b>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    Pricing rule ke bina save block ho jayega.
                  </div>
                )}
              </div>

              <button
                disabled={saving || loadingProduct || pricingPreviewLoading || isLockedAutoGeneratedHardcopy}
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
              >
                {isLockedAutoGeneratedHardcopy ? <Lock size={18} /> : <Save size={18} />}
                {saving ? "Saving..." : isLockedAutoGeneratedHardcopy ? "Locked Product" : isEdit ? "Update Product" : "Save Product"}
              </button>

              <div className="text-[11px] text-slate-500">
                ✅ Product type category-driven hai. ✅ Final price auto hai. ✅ Availability auto derived hai.
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}