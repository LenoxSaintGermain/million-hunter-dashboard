-- One Aperture thesis graph may be projected from each canonical main-app thesis.
-- Additive only: existing Aperture-native theses remain valid with a NULL source.
ALTER TABLE `capital_theses`
  ADD COLUMN `source_compilation_id` int NULL;

CREATE UNIQUE INDEX `capital_theses_source_compilation_id_unique`
  ON `capital_theses` (`source_compilation_id`);
