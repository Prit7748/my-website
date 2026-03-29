"use client";

type ComboPlaceholderCardProps = {
  title: string;
  desc: string;
  tag: string;
  variant?: "default" | "pyq" | "hardcopy";
};

export default function ComboPlaceholderCard({
  title,
  desc,
  tag,
  variant = "default",
}: ComboPlaceholderCardProps) {
  const topTagClass =
    variant === "pyq"
      ? "bg-emerald-600 text-white"
      : variant === "hardcopy"
      ? "bg-orange-600 text-white"
      : "bg-blue-600 text-white";

  const bottomNote =
    variant === "pyq"
      ? "Reserved for previous year paper combo previews with subject, medium, and session-based grouping."
      : variant === "hardcopy"
      ? "Reserved for handwritten hardcopy combo previews with delivery-focused presentation."
      : "Reserved for combo previews with bundled items, pricing highlights, and quick-access details.";

  return (
    <div className="rounded-[24px] border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-lg transition">
      <div className="aspect-[4/3] relative overflow-hidden border-b border-gray-100 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.08) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="absolute inset-0 p-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm"
            />
          ))}
        </div>

        <div className="absolute top-3 left-3 inline-flex items-center rounded-full bg-slate-900 text-white px-3 py-1 text-[11px] font-extrabold shadow">
          COMBO
        </div>

        <div
          className={`absolute top-3 right-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold shadow ${topTagClass}`}
        >
          {tag}
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm font-semibold text-slate-600 leading-relaxed">
          {desc}
        </p>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm font-extrabold text-slate-900">
            Combo preview layout
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-600 leading-relaxed">
            {bottomNote}
          </div>
        </div>
      </div>
    </div>
  );
}