-- School-provided payment details (Mobile Money + bank account) that parents
-- pay fees into directly. Manual/offline for now — no payment gateway yet,
-- this just gives parents the right number/account to send money to.

ALTER TABLE schools
  ADD COLUMN momo_provider      VARCHAR(30)  NULL AFTER address,
  ADD COLUMN momo_number        VARCHAR(20)  NULL AFTER momo_provider,
  ADD COLUMN momo_account_name  VARCHAR(150) NULL AFTER momo_number,
  ADD COLUMN bank_name          VARCHAR(150) NULL AFTER momo_account_name,
  ADD COLUMN bank_account_number VARCHAR(50) NULL AFTER bank_name,
  ADD COLUMN bank_account_name  VARCHAR(150) NULL AFTER bank_account_number;
