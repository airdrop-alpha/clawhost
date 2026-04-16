ALTER TABLE "claws" ADD COLUMN "tier" text NOT NULL DEFAULT 'basic';
ALTER TABLE "pending_claws" ADD COLUMN "tier" text NOT NULL DEFAULT 'basic';
