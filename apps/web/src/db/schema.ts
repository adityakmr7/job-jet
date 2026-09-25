import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  uuid,
  pgEnum,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import type {
  Link,
  Education,
  WorkExperience,
  Skill,
  ResumeContent,
} from "@job-jet/shared";

// Mirrors the Clerk user — kept minimal; Clerk remains the source of truth
// for auth, this just gives us a stable FK target and a join point.
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(), // one canonical profile per user
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  location: text("location"),
  links: jsonb("links").$type<Link[]>().default([]),
  summary: text("summary"),
  education: jsonb("education").$type<Education[]>().default([]),
  experience: jsonb("experience").$type<WorkExperience[]>().default([]),
  skills: jsonb("skills").$type<Skill[]>().default([]),
  workAuthorization: jsonb("work_authorization").$type<{
    authorizedToWork?: boolean;
    requiresSponsorship?: boolean;
  }>(),
  additionalQuestions: jsonb("additional_questions").$type<Record<string, string>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const resumeKindEnum = pgEnum("resume_kind", ["uploaded_original", "ai_tailored"]);

export const resumes = pgTable("resumes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: resumeKindEnum("kind").notNull(),
  fileName: text("file_name").notNull(),
  blobUrl: text("blob_url").notNull(),
  content: jsonb("content").$type<ResumeContent>().notNull(),
  tailoredFor: jsonb("tailored_for").$type<{
    jobTitle?: string;
    company?: string;
    jobDescription: string;
    applicationId?: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const applicationStatusEnum = pgEnum("application_status", [
  "detected",
  "draft",
  "applied",
  "interviewing",
  "rejected",
  "offer",
]);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    domain: text("domain").notNull(),
    company: text("company"),
    jobTitle: text("job_title"),
    jobDescription: text("job_description"),
    notes: text("notes"),
    resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
    status: applicationStatusEnum("status").notNull().default("detected"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // One tracked application per (user, url) — the extension upserts on this
  // so visiting/autofilling the same posting again updates the existing
  // row instead of creating a duplicate.
  (table) => [uniqueIndex("applications_user_url_idx").on(table.userId, table.url)]
);

export const fieldMappingSourceEnum = pgEnum("field_mapping_source", [
  "heuristic",
  "llm",
  "user_correction",
]);

// Crowdsourced across ALL users (not scoped to userId) — the whole point is
// that once one user's form gets mapped for a given ATS domain, everyone
// else hitting that same domain benefits without re-asking the LLM.
export const fieldMappings = pgTable(
  "field_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domain: text("domain").notNull(),
    fieldSignature: text("field_signature").notNull(),
    profileFieldPath: text("profile_field_path").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    source: fieldMappingSourceEnum("source").notNull(),
    hitCount: integer("hit_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("field_mappings_domain_signature_idx").on(table.domain, table.fieldSignature)]
);

// Per-user fixed-window counters for rate-limiting the AI endpoints (see
// src/lib/rate-limit.ts). key = "<bucket>:<userId>". Old windows are
// pruned opportunistically; rows are tiny.
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })]
);
