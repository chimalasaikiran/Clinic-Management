-- CreateEnum
CREATE TYPE "integration_provider" AS ENUM ('meta', 'google');

-- CreateEnum
CREATE TYPE "content_target" AS ENUM ('facebook', 'instagram');

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('draft', 'in_review', 'scheduled', 'publishing', 'published', 'failed');

-- CreateEnum
CREATE TYPE "publication_status" AS ENUM ('pending', 'publishing', 'published', 'failed', 'unknown');

-- CreateEnum
CREATE TYPE "response_status" AS ENUM ('draft', 'in_review', 'posting', 'posted', 'failed');

-- CreateEnum
CREATE TYPE "escalation_severity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "escalation_status" AS ENUM ('open', 'in_progress', 'resolved');

-- AlterEnum
ALTER TYPE "workflow_trigger" ADD VALUE 'review_request';

-- CreateTable
CREATE TABLE "growth_integrations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "provider" "integration_provider" NOT NULL,
    "status" "channel_status" NOT NULL DEFAULT 'not_connected',
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "description" VARCHAR(200),
    "last_error" VARCHAR(500),
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "growth_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_templates" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "body" VARCHAR(2200) NOT NULL,
    "cta" VARCHAR(120) NOT NULL,
    "targets" "content_target"[],
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_posts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "branch_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "caption" VARCHAR(2200) NOT NULL,
    "targets" "content_target"[],
    "cta" VARCHAR(120) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "alt_text" VARCHAR(1000) NOT NULL,
    "media_id" UUID,
    "template_id" UUID,
    "template_version" INTEGER,
    "scheduled_at" TIMESTAMPTZ(6),
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "rights_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "owner_membership_id" UUID NOT NULL,
    "submitted_by" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "review_note" VARCHAR(500),
    "claimed_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_publications" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "target" "content_target" NOT NULL,
    "status" "publication_status" NOT NULL DEFAULT 'pending',
    "provider_post_id" VARCHAR(200),
    "permalink" VARCHAR(500),
    "error_code" VARCHAR(80),
    "error_message" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_events" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_profiles" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "business_name" VARCHAR(120) NOT NULL,
    "street" VARCHAR(240) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "postal_code" CHAR(6) NOT NULL,
    "country" VARCHAR(60) NOT NULL DEFAULT 'India',
    "description" VARCHAR(750) NOT NULL DEFAULT '',
    "primary_category" VARCHAR(80) NOT NULL,
    "secondary_category" VARCHAR(80),
    "phone" VARCHAR(10),
    "website_url" VARCHAR(500),
    "review_url" VARCHAR(500),
    "google_location" VARCHAR(120),
    "synced_at" TIMESTAMPTZ(6),
    "sync_error" VARCHAR(500),
    "reviews_synced_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branch_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_hours" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "opens_at" VARCHAR(5),
    "closes_at" VARCHAR(5),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "special_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'google',
    "provider_review_id" VARCHAR(300) NOT NULL,
    "reviewer_name" VARCHAR(120) NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(4096),
    "posted_at" TIMESTAMPTZ(6) NOT NULL,
    "provider_updated_at" TIMESTAMPTZ(6) NOT NULL,
    "public_reply" VARCHAR(4096),
    "public_reply_at" TIMESTAMPTZ(6),
    "synced_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_responses" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "text" VARCHAR(4096) NOT NULL,
    "status" "response_status" NOT NULL DEFAULT 'draft',
    "submitted_by" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "posted_at" TIMESTAMPTZ(6),
    "review_note" VARCHAR(500),
    "error_message" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_notes" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "review_id" UUID NOT NULL,
    "topic" VARCHAR(120) NOT NULL,
    "severity" "escalation_severity" NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "escalation_status" NOT NULL DEFAULT 'open',
    "note" VARCHAR(2000) NOT NULL DEFAULT '',
    "resolved_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "growth_integrations_org_id_provider_key" ON "growth_integrations"("org_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "content_templates_org_id_code_key" ON "content_templates"("org_id", "code");

-- CreateIndex
CREATE INDEX "content_posts_org_id_scheduled_at_idx" ON "content_posts"("org_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "content_posts_status_scheduled_at_idx" ON "content_posts"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_posts_org_id_code_key" ON "content_posts"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "content_publications_post_id_target_key" ON "content_publications"("post_id", "target");

-- CreateIndex
CREATE INDEX "content_events_post_id_created_at_idx" ON "content_events"("post_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "branch_profiles_branch_id_key" ON "branch_profiles"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "special_hours_profile_id_date_key" ON "special_hours"("profile_id", "date");

-- CreateIndex
CREATE INDEX "reviews_org_id_branch_id_posted_at_idx" ON "reviews"("org_id", "branch_id", "posted_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_org_id_provider_review_id_key" ON "reviews"("org_id", "provider_review_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_responses_review_id_key" ON "review_responses"("review_id");

-- CreateIndex
CREATE INDEX "review_notes_review_id_created_at_idx" ON "review_notes"("review_id", "created_at");

-- CreateIndex
CREATE INDEX "escalations_org_id_status_due_at_idx" ON "escalations"("org_id", "status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "escalations_org_id_code_key" ON "escalations"("org_id", "code");

-- AddForeignKey
ALTER TABLE "growth_integrations" ADD CONSTRAINT "growth_integrations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "content_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_publications" ADD CONSTRAINT "content_publications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_events" ADD CONSTRAINT "content_events_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_events" ADD CONSTRAINT "content_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_profiles" ADD CONSTRAINT "branch_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_profiles" ADD CONSTRAINT "branch_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_profiles" ADD CONSTRAINT "branch_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_hours" ADD CONSTRAINT "special_hours_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "branch_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rules the application also checks, kept here so no other writer can break them.
ALTER TABLE "growth_integrations" ADD CONSTRAINT "growth_integrations_connected_has_secret" CHECK ("status" <> 'connected' OR "secret" IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size" CHECK ("size" > 0 AND "size" <= 5242880 AND "mime_type" IN ('image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_has_target" CHECK (cardinality("targets") >= 1);
-- Two people: whoever submitted a post or a review reply cannot be the one who approves it.
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_two_people" CHECK ("approved_by" IS NULL OR "approved_by" <> "submitted_by");
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_scheduled_approved" CHECK ("status" NOT IN ('scheduled', 'publishing', 'published') OR ("approved_by" IS NOT NULL AND "scheduled_at" IS NOT NULL));
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_two_people" CHECK ("approved_by" IS NULL OR "approved_by" <> "submitted_by");
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_posting_approved" CHECK ("status" NOT IN ('posting', 'posted') OR "approved_by" IS NOT NULL);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "branch_profiles" ADD CONSTRAINT "branch_profiles_postal_code" CHECK ("postal_code" ~ '^[1-9][0-9]{5}$');
ALTER TABLE "special_hours" ADD CONSTRAINT "special_hours_times" CHECK ("closed" OR ("opens_at" IS NOT NULL AND "closes_at" IS NOT NULL AND "closes_at" > "opens_at"));
