-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "device_name" VARCHAR(120),
ADD COLUMN     "kind" VARCHAR(10) NOT NULL DEFAULT 'browser';

-- CreateTable
CREATE TABLE "staff_app_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mobile" VARCHAR(10) NOT NULL,
    "ticket_hash" CHAR(64) NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "device_name" VARCHAR(120) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_app_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_app_challenges_ticket_hash_key" ON "staff_app_challenges"("ticket_hash");

-- CreateIndex
CREATE INDEX "staff_app_challenges_user_id_created_at_idx" ON "staff_app_challenges"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_app_challenges_expires_at_idx" ON "staff_app_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "staff_app_challenges" ADD CONSTRAINT "staff_app_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "sessions" ADD CONSTRAINT "sessions_kind" CHECK ("kind" IN ('browser', 'app'));
