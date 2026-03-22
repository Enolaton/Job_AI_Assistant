-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "situation" TEXT,
    "task" TEXT,
    "action" TEXT,
    "result" TEXT,
    "insight" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "tags" JSONB DEFAULT '[]',

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_analyses" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "jd_url" TEXT,
    "jd_raw_text" TEXT,
    "analysis_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_roles" (
    "id" SERIAL NOT NULL,
    "analysis_id" INTEGER NOT NULL,
    "role_title" TEXT NOT NULL,
    "department" TEXT,
    "location" TEXT,
    "requirements" TEXT,
    "tasks" TEXT,
    "preferred" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_introductions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "analysis_id" INTEGER,
    "role_id" INTEGER,
    "title" TEXT NOT NULL,
    "name" TEXT,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT '작성전',
    "manual_company_name" TEXT,
    "manual_job_title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_introductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_intro_items" (
    "id" SERIAL NOT NULL,
    "self_intro_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "ai_guide" TEXT,
    "char_limit" INTEGER NOT NULL DEFAULT 700,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "self_intro_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "content_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_reports" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "report_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_analyses" (
    "id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,
    "ideal_candidate" JSONB,
    "corporate_culture" JSONB,
    "business_summary" TEXT,
    "product_summary" TEXT,
    "financial_summary" TEXT,
    "report_year" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "company_reports_user_id_company_name_key" ON "company_reports"("user_id", "company_name");

-- CreateIndex
CREATE UNIQUE INDEX "company_analyses_company_name_key" ON "company_analyses"("company_name");

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "job_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_introductions" ADD CONSTRAINT "self_introductions_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "job_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_introductions" ADD CONSTRAINT "self_introductions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_introductions" ADD CONSTRAINT "self_introductions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_intro_items" ADD CONSTRAINT "self_intro_items_self_intro_id_fkey" FOREIGN KEY ("self_intro_id") REFERENCES "self_introductions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_reports" ADD CONSTRAINT "company_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
