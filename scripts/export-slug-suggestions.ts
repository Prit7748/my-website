import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const ANALYSIS_PATH = join(process.cwd(), "data", "long-url-analysis.json");
const OUTPUT_PATH = join(process.cwd(), "data", "slug-suggestions.json");

type SlimSuggestion = {
  title: string;
  category: string;
  currentSlug: string;
  suggestedSlug: string;
};

function main() {
  if (!existsSync(ANALYSIS_PATH)) {
    console.error(`Missing ${ANALYSIS_PATH}`);
    console.error("Run: npm run analyze-long-urls");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(ANALYSIS_PATH, "utf8")) as {
    analyzedAt: string;
    results: Array<{
      title: string;
      category: string;
      currentSlug: string;
      suggestedSlug: string;
    }>;
  };

  const suggestions: SlimSuggestion[] = data.results.map((item) => ({
    title: item.title,
    category: item.category,
    currentSlug: item.currentSlug,
    suggestedSlug: item.suggestedSlug,
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    sourceFile: "data/long-url-analysis.json",
    total: suggestions.length,
    suggestions,
  };

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log(`Exported ${suggestions.length} slug suggestions to ${OUTPUT_PATH}`);
}

main();
