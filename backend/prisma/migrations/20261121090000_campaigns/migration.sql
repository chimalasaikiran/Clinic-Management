-- CreateEnum
CREATE TYPE "message_origin" AS ENUM ('manual', 'broadcast', 'workflow');

-- CreateEnum
CREATE TYPE "audience_status" AS ENUM ('draft', 'ready', 'archived');

-- CreateEnum
CREATE TYPE "campaign_channel" AS ENUM ('paid_search', 'meta_ads', 'whatsapp', 'sms', 'email', 'phone');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "broadcast_status" AS ENUM ('scheduled', 'sending', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "workflow_trigger" AS ENUM ('no_show', 'lead_not_booked', 'revisit_due');

-- CreateEnum
CREATE TYPE "workflow_status" AS ENUM ('draft', 'active', 'paused');

-- CreateEnum
CREATE TYPE "workflow_run_outcome" AS ENUM ('queued', 'skipped');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "campaign_id" UUID;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "origin" "message_origin" NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "audiences" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "purpose" VARCHAR(500) NOT NULL,
    "branch_id" UUID,
    "status" "audience_status" NOT NULL DEFAULT 'draft',
    "rules" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_versions" (
    "id" UUID NOT NULL,
    "audience_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "change_note" VARCHAR(500) NOT NULL,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audience_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "objective" VARCHAR(300) NOT NULL,
    "channel" "campaign_channel" NOT NULL,
    "status" "campaign_status" NOT NULL DEFAULT 'draft',
    "branch_id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "audience_id" UUID,
    "budget" DECIMAL(12,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "cta" VARCHAR(120) NOT NULL,
    "landing_url" VARCHAR(500) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_spend" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "spent_on" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" VARCHAR(300) NOT NULL,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_spend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_events" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "details" JSONB,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_broadcasts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "audience_id" UUID NOT NULL,
    "audience_version" INTEGER NOT NULL,
    "template_id" UUID NOT NULL,
    "template_version" INTEGER NOT NULL,
    "channel" "message_channel" NOT NULL,
    "variables" JSONB NOT NULL,
    "status" "broadcast_status" NOT NULL DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "claimed_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "weekly_cap" INTEGER NOT NULL DEFAULT 2,
    "expected_recipients" INTEGER NOT NULL,
    "queued_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "cancelled_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" UUID NOT NULL,
    "broadcast_id" UUID NOT NULL,
    "address" VARCHAR(254) NOT NULL,
    "lead_id" UUID,
    "patient_id" UUID,
    "message_id" UUID,
    "skip_reason" VARCHAR(40),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "trigger" "workflow_trigger" NOT NULL,
    "delay_hours" INTEGER NOT NULL,
    "branch_id" UUID,
    "template_id" UUID,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "weekly_cap" INTEGER NOT NULL DEFAULT 2,
    "status" "workflow_status" NOT NULL DEFAULT 'draft',
    "owner_membership_id" UUID NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "activated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "change_note" VARCHAR(500),
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version" INTEGER NOT NULL,
    "subject_key" VARCHAR(80) NOT NULL,
    "lead_id" UUID,
    "patient_id" UUID,
    "appointment_id" UUID,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "outcome" "workflow_run_outcome" NOT NULL,
    "skip_reason" VARCHAR(40),
    "message_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audiences_org_id_code_key" ON "audiences"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "audience_versions_audience_id_version_key" ON "audience_versions"("audience_id", "version");

-- CreateIndex
CREATE INDEX "campaigns_org_id_start_date_idx" ON "campaigns"("org_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_org_id_code_key" ON "campaigns"("org_id", "code");

-- CreateIndex
CREATE INDEX "campaign_spend_campaign_id_spent_on_idx" ON "campaign_spend"("campaign_id", "spent_on");

-- CreateIndex
CREATE INDEX "campaign_events_campaign_id_created_at_idx" ON "campaign_events"("campaign_id", "created_at");

-- CreateIndex
CREATE INDEX "campaign_broadcasts_status_scheduled_at_idx" ON "campaign_broadcasts"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "campaign_broadcasts_campaign_id_created_at_idx" ON "campaign_broadcasts"("campaign_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_recipients_message_id_key" ON "broadcast_recipients"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_recipients_broadcast_id_address_key" ON "broadcast_recipients"("broadcast_id", "address");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_org_id_code_key" ON "workflows"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_message_id_key" ON "workflow_runs"("message_id");

-- CreateIndex
CREATE INDEX "workflow_runs_org_id_created_at_idx" ON "workflow_runs"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_workflow_id_subject_key_key" ON "workflow_runs"("workflow_id", "subject_key");

-- CreateIndex
CREATE INDEX "leads_org_id_campaign_id_idx" ON "leads"("org_id", "campaign_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_versions" ADD CONSTRAINT "audience_versions_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "audiences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_versions" ADD CONSTRAINT "audience_versions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "audiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_spend" ADD CONSTRAINT "campaign_spend_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_spend" ADD CONSTRAINT "campaign_spend_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_broadcasts" ADD CONSTRAINT "campaign_broadcasts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_broadcasts" ADD CONSTRAINT "campaign_broadcasts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_broadcasts" ADD CONSTRAINT "campaign_broadcasts_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "audiences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_broadcasts" ADD CONSTRAINT "campaign_broadcasts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_broadcasts" ADD CONSTRAINT "campaign_broadcasts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_broadcasts" ADD CONSTRAINT "campaign_broadcasts_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "campaign_broadcasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_activated_by_fkey" FOREIGN KEY ("activated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Rules the application also checks, kept here so no other writer can break them.
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_budget_positive" CHECK ("budget" > 0);
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_dates_ordered" CHECK ("end_date" >= "start_date");
ALTER TABLE "campaign_spend" ADD CONSTRAINT "campaign_spend_amount_nonzero" CHECK ("amount" <> 0);
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_version_positive" CHECK ("version" >= 1);
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_delay_positive" CHECK ("delay_hours" >= 1);
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_weekly_cap_range" CHECK ("weekly_cap" BETWEEN 1 AND 14);
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_active_has_template" CHECK ("status" <> 'active' OR ("template_id" IS NOT NULL AND "activated_at" IS NOT NULL));
ALTER TABLE "campaign_broadcasts" ADD CONSTRAINT "campaign_broadcasts_counts" CHECK ("expected_recipients" >= 0 AND "queued_count" >= 0 AND "skipped_count" >= 0);
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_outcome" CHECK (("message_id" IS NULL) <> ("skip_reason" IS NULL));
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_outcome" CHECK (("outcome" = 'queued') = ("message_id" IS NOT NULL) AND ("outcome" = 'skipped') = ("skip_reason" IS NOT NULL));
