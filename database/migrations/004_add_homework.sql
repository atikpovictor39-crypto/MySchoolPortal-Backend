-- Homework/assignments per class+subject. No submission/grading workflow
-- yet (that would need file upload infra) — this is "post it, parents see it."

CREATE TABLE homework (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  class_id      BIGINT UNSIGNED NOT NULL,
  subject_id    BIGINT UNSIGNED NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  due_date      DATE NOT NULL,
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_hw_school (school_id),
  INDEX idx_hw_class_due (class_id, due_date)
) ENGINE=InnoDB;
