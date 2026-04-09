import mongoose, { Schema, models, model } from "mongoose";

const BlogSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },

    // On-page summary / fallback SEO description
    excerpt: { type: String, default: "", trim: true },

    // Main rendered article body
    contentHtml: { type: String, default: "" },

    // SEO-specific optional overrides (fallback to title/excerpt if empty)
    metaTitle: { type: String, default: "", trim: true },
    metaDescription: { type: String, default: "", trim: true },

    // Blog cover image
    coverUrl: { type: String, default: "", trim: true },
    coverAlt: { type: String, default: "", trim: true },

    youtubeUrl: { type: String, default: "", trim: true },
    tags: { type: [String], default: [], index: true },

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "BlogCategory",
      default: null,
      index: true,
    },

    authorName: { type: String, default: "IGNOU Students Portal", trim: true },

    isPublished: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

BlogSchema.index({ slug: 1, isPublished: 1 });
BlogSchema.index({ tags: 1, isPublished: 1 });
BlogSchema.index({ categoryId: 1, isPublished: 1 });
BlogSchema.index({ isPublished: 1, publishedAt: -1 });
BlogSchema.index({ updatedAt: -1 });

export type BlogDoc = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml?: string;
  metaTitle?: string;
  metaDescription?: string;
  coverUrl?: string;
  coverAlt?: string;
  youtubeUrl?: string;
  tags?: string[];
  categoryId?: any;
  authorName?: string;
  isPublished?: boolean;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const BlogModel = models.Blog || model("Blog", BlogSchema);

export default BlogModel;