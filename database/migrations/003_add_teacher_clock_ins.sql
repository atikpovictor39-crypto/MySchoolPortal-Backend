-- Teacher clock-in/out. One row per shift: clock_out_at NULL means the
-- teacher is currently clocked in.

CREATE TABLE teacher_clock_ins (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  teacher_id    BIGINT UNSIGNED NOT NULL,
  clock_in_at   DATETIME NOT NULL,
  clock_out_at  DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  INDEX idx_clock_school (school_id),
  INDEX idx_clock_teacher (teacher_id)
) ENGINE=InnoDB;
