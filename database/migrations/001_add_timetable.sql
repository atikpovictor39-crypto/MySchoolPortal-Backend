-- Adds weekly class scheduling. Not in the original schema.sql (Step 1
-- covered academic structure but not day/time timetabling).
-- Run once against an existing database: applied here, and folded into
-- schema.sql for anyone spinning up a fresh install.

CREATE TABLE timetable_slots (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  class_id      BIGINT UNSIGNED NOT NULL,
  day_of_week   TINYINT UNSIGNED NOT NULL,           -- 1=Monday ... 7=Sunday
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  subject_id    BIGINT UNSIGNED NOT NULL,
  teacher_id    BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
  UNIQUE KEY uq_class_day_start (class_id, day_of_week, start_time),
  INDEX idx_tt_school (school_id),
  INDEX idx_tt_class_day (class_id, day_of_week),
  INDEX idx_tt_teacher (teacher_id)
) ENGINE=InnoDB;
