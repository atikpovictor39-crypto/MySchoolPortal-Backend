-- Parent-submitted "I paid this" claims for a fee invoice, awaiting admin
-- confirmation against their real MoMo/bank statement. There's still no
-- payment gateway wired in -- this just tells the admin who to expect money
-- from and for what, instead of them having to guess from an anonymous
-- incoming transfer.

CREATE TABLE fee_payment_claims (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id       BIGINT UNSIGNED NOT NULL,
  invoice_id      BIGINT UNSIGNED NOT NULL,
  student_id      BIGINT UNSIGNED NOT NULL,
  parent_user_id  BIGINT UNSIGNED NOT NULL,
  amount_cents    INT UNSIGNED NOT NULL,
  payment_method  ENUM('mobile_money','bank_transfer') NOT NULL,
  paid_at         DATE NOT NULL,
  reference       VARCHAR(150),
  status          ENUM('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by     BIGINT UNSIGNED NULL,
  reviewed_at     DATETIME NULL,
  review_note     VARCHAR(255) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES fee_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  INDEX idx_claims_school_status (school_id, status),
  INDEX idx_claims_invoice (invoice_id)
) ENGINE=InnoDB;
