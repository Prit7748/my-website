import type { Metadata } from "next";

const BASE_URL = "https://istudentsportal.com";
const PAGE_URL = `${BASE_URL}/courses`;

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "IGNOU Courses",
  description:
    "Browse all IGNOU courses by course code and find related solved assignments, question papers, handwritten PDFs, ebooks, projects and study material.",
  alternates: {
    canonical: PAGE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    siteName: "IGNOU Students Portal",
    title: "IGNOU Courses | IGNOU Students Portal",
    description:
      "Browse all IGNOU courses by course code and find related study material quickly.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "IGNOU Courses - IGNOU Students Portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IGNOU Courses | IGNOU Students Portal",
    description:
      "Browse all IGNOU courses by course code and find related study material quickly.",
    images: ["/og.jpg"],
  },
};

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}