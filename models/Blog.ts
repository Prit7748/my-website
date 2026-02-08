// models/Blog.ts
import mongoose, { Schema, models, model } from "mongoose";

const BlogSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, index: true },

    excerpt: { type: String, default: "", trim: true }, // short summary for SEO/cards
    contentHtml: { type: String, default: "" }, // main blog content (HTML)

    coverUrl: { type: String, default: "", trim: true }, // OG image + hero image

    // Optional rich features
    youtubeUrl: { type: String, default: "", trim: true }, // auto embedded on page
    tags: { type: [String], default: [], index: true }, // for related blogs

    authorName: { type: String, default: "IGNOU Students Portal", trim: true },

    isPublished: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

BlogSchema.index({ slug: 1, isPublished: 1 });
BlogSchema.index({ tags: 1, isPublished: 1 });

export type BlogDoc = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml?: string;
  coverUrl?: string;
  youtubeUrl?: string;
  tags?: string[];
  authorName?: string;
  isPublished?: boolean;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export default models.Blog || model("Blog", BlogSchema);
