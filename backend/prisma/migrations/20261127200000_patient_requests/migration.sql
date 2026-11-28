-- CreateEnum
CREATE TYPE "refill_status" AS ENUM ('requested', 'approved', 'declined', 'cancelled');

-- CreateEnum
CREATE TYPE "support_status" AS ENUM ('open', 'answered', 'resolved');

-- CreateTable
CREATE TABLE "refill_requests" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "status" "refill_status" NOT NULL DEFAULT 'requested',
    "note" VARCHAR(500),
    "decision_note" VARCHAR(500),
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "refill_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "status" "support_status" NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_account_id" UUID,
    "author_user_id" UUID,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refill_requests_org_id_status_created_at_idx" ON "refill_requests"("org_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "refill_requests_prescription_id_created_at_idx" ON "refill_requests"("prescription_id", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_org_id_status_updated_at_idx" ON "support_tickets"("org_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "support_tickets_account_id_updated_at_idx" ON "support_tickets"("account_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_org_id_reference_key" ON "support_tickets"("org_id", "reference");

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "patient_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "patient_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_account_id_fkey" FOREIGN KEY ("author_account_id") REFERENCES "patient_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A prescription has at most one refill request waiting for the clinic.
CREATE UNIQUE INDEX "refill_requests_one_open_per_prescription" ON "refill_requests" ("prescription_id") WHERE "status" = 'requested';
-- A declined request always tells the patient why.
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_decline_reason" CHECK ("status" <> 'declined' OR "decision_note" IS NOT NULL);
-- Every message has exactly one author: the patient's account or a staff user.
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_one_author" CHECK (("author_account_id" IS NULL) <> ("author_user_id" IS NULL));
