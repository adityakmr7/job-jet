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
  boolean,
  bigint,
  index,
} from "drizzle-orm/pg-core";
import type {
  Link,
  Education,
  WorkExperience,
  Skill,
  ResumeContent,
} from "@job-jet/shared";

// --- Better Auth tables ------------------------------------------------------
// Owned by Better Auth (src/lib/auth/server.ts, Drizzle adapter). Field names
// (the JS keys) must match Better Auth's model fields; the SQL column names
// are ours. See https://www.better-auth.com/docs/concepts/database#core-schema
// Every app table's user_id references user.id with ON DELETE CASCADE, so
// deleting an account removes all of that user's rows.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

// Better Auth's own rate limiter (sign-in, sign-up, password reset, ...),
// stored in Postgres so limits hold across serverless instances. Separate
// from `rate_limits` below, which throttles the AI endpoints per user.
export const authRateLimit = pgTable("auth_rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
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
    .references(() => user.id, { onDelete: "cascade" }),
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
      .references(() => user.id, { onDelete: "cascade" }),
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
