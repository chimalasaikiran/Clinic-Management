-- CreateEnum
CREATE TYPE "message_channel" AS ENUM ('whatsapp', 'sms', 'email');

-- CreateEnum
CREATE TYPE "channel_status" AS ENUM ('not_connected', 'connected', 'error');

-- CreateEnum
CREATE TYPE "template_status" AS ENUM ('draft', 'approved', 'retired');

-- CreateEnum
CREATE TYPE "consent_status" AS ENUM ('granted', 'withdrawn');

-- CreateEnum
CREATE TYPE "conversation_status" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "message_direction" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'unknown', 'received');

-- CreateTable
CREATE TABLE "messaging_channels" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "channel" "message_channel" NOT NULL,
    "status" "channel_status" NOT NULL DEFAULT 'not_connected',
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret" TEXT,
    "webhook_token" VARCHAR(64) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(500),
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "messaging_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "channel" "message_channel" NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "subject" VARCHAR(160),
    "body" VARCHAR(2000) NOT NULL,
    "status" "template_status" NOT NULL DEFAULT 'draft',
    "provider_ref" VARCHAR(120),
    "version" INTEGER NOT NULL DEFAULT 1,
    "change_note" VARCHAR(500),
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_consents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "channel" "message_channel" NOT NULL,
    "address" VARCHAR(254) NOT NULL,
    "status" "consent_status" NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "note" VARCHAR(500),
    "lead_id" UUID,
    "patient_id" UUID,
    "recorded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "channel" "message_channel" NOT NULL,
    "address" VARCHAR(254) NOT NULL,
    "branch_id" UUID,
    "lead_id" UUID,
    "patient_id" UUID,
    "status" "conversation_status" NOT NULL DEFAULT 'open',
    "owner_membership_id" UUID,
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "last_message_at" TIMESTAMPTZ(6),
    "last_inbound_at" TIMESTAMPTZ(6),
    "preview" VARCHAR(160),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "direction" "message_direction" NOT NULL,
    "status" "message_status" NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "subject" VARCHAR(160),
    "template_id" UUID,
    "template_version" INTEGER,
    "parameters" JSONB,
    "provider_message_id" VARCHAR(200),
    "error_code" VARCHAR(80),
    "error_message" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "sent_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_notes" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "messaging_channels_org_id_channel_key" ON "messaging_channels"("org_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_channels_webhook_token_key" ON "messaging_channels"("webhook_token");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_org_id_code_key" ON "message_templates"("org_id", "code");

-- CreateIndex
CREATE INDEX "contact_consents_org_id_channel_address_created_at_idx" ON "contact_consents"("org_id", "channel", "address", "created_at");

-- CreateIndex
CREATE INDEX "conversations_org_id_last_message_at_idx" ON "conversations"("org_id", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_org_id_channel_address_key" ON "conversations"("org_id", "channel", "address");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_org_id_number_key" ON "conversations"("org_id", "number");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_status_next_attempt_at_idx" ON "messages"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_org_id_provider_message_id_key" ON "messages"("org_id", "provider_message_id");

-- CreateIndex
CREATE INDEX "conversation_notes_conversation_id_created_at_idx" ON "conversation_notes"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "messaging_channels" ADD CONSTRAINT "messaging_channels_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_channels" ADD CONSTRAINT "messaging_channels_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guards the application also enforces, kept in the database so no write path can break them.
ALTER TABLE "messaging_channels" ADD CONSTRAINT "messaging_channels_connected_check"
  CHECK ("status" = 'not_connected' OR "secret" IS NOT NULL);
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_version_check" CHECK ("version" >= 1);
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_address_check"
  CHECK (("channel" = 'email' AND "address" = lower("address") AND "address" LIKE '%@%') OR ("channel" <> 'email' AND "address" ~ '^[6-9][0-9]{9}$'));
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_address_check"
  CHECK (("channel" = 'email' AND "address" = lower("address") AND "address" LIKE '%@%') OR ("channel" <> 'email' AND "address" ~ '^[6-9][0-9]{9}$'));
ALTER TABLE "messages" ADD CONSTRAINT "messages_direction_check"
  CHECK (("direction" = 'inbound') = ("status" = 'received') AND "attempts" >= 0);
