-- Correct the bridge cardinality: each user may maintain their own Aperture
-- projection of a shared canonical thesis.
DROP INDEX `capital_theses_source_compilation_id_unique` ON `capital_theses`;

CREATE UNIQUE INDEX `capital_theses_user_source_compilation_unique`
  ON `capital_theses` (`user_id`, `source_compilation_id`);

CREATE TABLE `thesis_shares` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `compilation_id` int NOT NULL,
  `user_id` int NOT NULL,
  `shared_by_user_id` int NOT NULL,
  `permission` enum('view','use') NOT NULL DEFAULT 'use',
  `created_at` bigint NOT NULL,
  CONSTRAINT `thesis_shares_compilation_user_unique` UNIQUE(`compilation_id`, `user_id`)
);
