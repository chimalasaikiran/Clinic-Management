-- CreateEnum
CREATE TYPE "patient_account_status" AS ENUM ('active', 'disabled', 'deleted');

-- CreateEnum
CREATE TYPE "patient_link_method" AS ENUM ('mobile_dob', 'clinic_code');

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "listed_in_patient_app" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "longitude" DECIMAL(9,6);

-- CreateTable
CREATE TABLE "patient_accounts" (
    "id" UUID NOT NULL,
    "mobile" VARCHAR(10),
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254),
    "password_hash" VARCHAR(255),
    "date_of_birth" DATE,
    "gender" "gender",
    "blood_group" VARCHAR(3),
    "address_line" VARCHAR(240),
    "city" VARCHAR(80),
    "state" VARCHAR(80),
    "pin_code" CHAR(6),
    "emergency_name" VARCHAR(120),
    "emergency_relation" VARCHAR(40),
    "emergency_phone" VARCHAR(10),
    "language" VARCHAR(5) NOT NULL DEFAULT 'en',
    "status" "patient_account_status" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patient_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_otps" (
    "id" UUID NOT NULL,
    "mobile" VARCHAR(10) NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ(6),
    "ticket_hash" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "device_name" VARCHAR(120) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "patient_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_links" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "method" "patient_link_method" NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,

    CONSTRAINT "patient_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_link_codes" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "issued_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_consents" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policy_version" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_accounts_mobile_key" ON "patient_accounts"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "patient_otps_ticket_hash_key" ON "patient_otps"("ticket_hash");

-- CreateIndex
CREATE INDEX "patient_otps_mobile_created_at_idx" ON "patient_otps"("mobile", "created_at" DESC);

-- CreateIndex
CREATE INDEX "patient_otps_expires_at_idx" ON "patient_otps"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "patient_sessions_token_hash_key" ON "patient_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "patient_sessions_account_id_revoked_at_idx" ON "patient_sessions"("account_id", "revoked_at");

-- CreateIndex
CREATE INDEX "patient_sessions_expires_at_idx" ON "patient_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "patient_links_org_id_patient_id_idx" ON "patient_links"("org_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_links_account_id_patient_id_key" ON "patient_links"("account_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_link_codes_code_hash_key" ON "patient_link_codes"("code_hash");

-- CreateIndex
CREATE INDEX "patient_link_codes_patient_id_created_at_idx" ON "patient_link_codes"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "patient_consents_account_id_purpose_created_at_idx" ON "patient_consents"("account_id", "purpose", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "patient_sessions" ADD CONSTRAINT "patient_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "patient_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_links" ADD CONSTRAINT "patient_links_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "patient_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_links" ADD CONSTRAINT "patient_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_links" ADD CONSTRAINT "patient_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_links" ADD CONSTRAINT "patient_links_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_link_codes" ADD CONSTRAINT "patient_link_codes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_link_codes" ADD CONSTRAINT "patient_link_codes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_link_codes" ADD CONSTRAINT "patient_link_codes_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "patient_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A clinic record is readable by at most one app account at a time.
CREATE UNIQUE INDEX "patient_links_one_active_per_patient" ON "patient_links" ("patient_id") WHERE "revoked_at" IS NULL;

ALTER TABLE "patient_accounts" ADD CONSTRAINT "patient_accounts_mobile_format" CHECK ("mobile" ~ '^[6-9][0-9]{9}$');
-- A live account always has the number it signs in with.
ALTER TABLE "patient_accounts" ADD CONSTRAINT "patient_accounts_mobile_unless_deleted" CHECK ("status" = 'deleted' OR "mobile" IS NOT NULL);
ALTER TABLE "branches" ADD CONSTRAINT "branches_coordinates" CHECK (
  ("latitude" IS NULL) = ("longitude" IS NULL)
  AND ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180))
);
