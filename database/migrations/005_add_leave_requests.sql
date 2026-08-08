-- Teacher leave requests: submit, admin approves/rejects.

CREATE TABLE leave_requests (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  teacher_id    BIGINT UNSIGNED NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        VARCHAR(500),
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by   BIGINT UNSIGNED NULL,
  reviewed_at   DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  INDEX idx_leave_school (school_id),
  INDEX idx_leave_teacher (teacher_id),
  INDEX idx_leave_status (school_id, status)
) ENGINE=InnoDB;
