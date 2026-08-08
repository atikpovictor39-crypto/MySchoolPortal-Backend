-- Stores Web Push subscriptions (one row per browser/device a user has
-- opted into notifications on). Not in the original schema — added when
-- push notifications replaced SMS as the "notify parents" mechanism.

CREATE TABLE push_subscriptions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  endpoint      VARCHAR(500) NOT NULL,
  p256dh        VARCHAR(255) NOT NULL,
  auth          VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_endpoint (user_id, endpoint(255)),
  INDEX idx_push_user (user_id)
) ENGINE=InnoDB;
