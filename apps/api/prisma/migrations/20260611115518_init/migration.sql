-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('lunch', 'dinner', 'general');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'needs_review', 'failed');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('phone_ai', 'admin', 'manual');

-- CreateEnum
CREATE TYPE "CalendarSyncStatus" AS ENUM ('pending', 'synced', 'failed', 'disabled');

-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "default_language" TEXT NOT NULL DEFAULT 'es',
    "calendar_id" TEXT,
    "notification_email" TEXT,
    "notification_phone" TEXT,
    "is_ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_party_size_global" INTEGER NOT NULL DEFAULT 12,
    "elevenlabs_agent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_hours" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL DEFAULT 'general',

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "slot_time" TEXT NOT NULL,
    "max_covers" INTEGER NOT NULL,
    "max_party_size_auto_confirm" INTEGER NOT NULL DEFAULT 8,
    "reservation_duration_minutes" INTEGER NOT NULL DEFAULT 90,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_slots" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "source" "ReservationSource" NOT NULL DEFAULT 'phone_ai',
    "needs_review_reason" TEXT,
    "idempotency_key" TEXT,
    "calendar_event_id" TEXT,
    "calendar_sync_status" "CalendarSyncStatus" NOT NULL DEFAULT 'disabled',
    "calendar_sync_attempts" INTEGER NOT NULL DEFAULT 0,
    "calendar_last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "provider_call_id" TEXT,
    "caller_phone" TEXT,
    "transcript" TEXT,
    "extracted_intent" TEXT,
    "outcome" TEXT,
    "tool_calls" JSONB NOT NULL DEFAULT '[]',
    "reservation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opening_hours_restaurant_id_day_of_week_idx" ON "opening_hours"("restaurant_id", "day_of_week");

-- CreateIndex
CREATE INDEX "availability_rules_restaurant_id_day_of_week_idx" ON "availability_rules"("restaurant_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "availability_rules_restaurant_id_day_of_week_service_type_s_key" ON "availability_rules"("restaurant_id", "day_of_week", "service_type", "slot_time");

-- CreateIndex
CREATE INDEX "blocked_slots_restaurant_id_date_idx" ON "blocked_slots"("restaurant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_idempotency_key_key" ON "reservations"("idempotency_key");

-- CreateIndex
CREATE INDEX "reservations_restaurant_id_date_time_idx" ON "reservations"("restaurant_id", "date", "time");

-- CreateIndex
CREATE INDEX "reservations_restaurant_id_status_idx" ON "reservations"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "reservations_restaurant_id_customer_phone_idx" ON "reservations"("restaurant_id", "customer_phone");

-- CreateIndex
CREATE INDEX "reservations_calendar_sync_status_status_idx" ON "reservations"("calendar_sync_status", "status");

-- CreateIndex
CREATE UNIQUE INDEX "call_logs_provider_call_id_key" ON "call_logs"("provider_call_id");

-- CreateIndex
CREATE INDEX "call_logs_restaurant_id_created_at_idx" ON "call_logs"("restaurant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
