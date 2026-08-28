ALTER TABLE `users`
  MODIFY COLUMN `role` enum('user','admin','investor','insurance','capital_operator') NOT NULL DEFAULT 'user';

ALTER TABLE `invite_tokens`
  MODIFY COLUMN `assign_role` enum('user','admin','investor','insurance','capital_operator') NOT NULL;

ALTER TABLE `role_module_permissions`
  MODIFY COLUMN `role` enum('admin','investor','insurance','user','capital_operator') NOT NULL;

INSERT INTO `role_module_permissions` (`role`, `module_key`, `enabled`)
SELECT 'capital_operator', module_key,
  CASE WHEN module_key IN ('capital_aperture', 'thesis_engine') THEN TRUE ELSE FALSE END
FROM (
  SELECT 'command_center' AS module_key UNION ALL
  SELECT 'market_scan' UNION ALL SELECT 'tide' UNION ALL SELECT 'memos' UNION ALL
  SELECT 'outreach' UNION ALL SELECT 'freedom_map' UNION ALL SELECT 'strategy_blender' UNION ALL
  SELECT 'opportunity_radar' UNION ALL SELECT 'asset_scout' UNION ALL SELECT 'thesis_engine' UNION ALL
  SELECT 'capital_stack' UNION ALL SELECT 'investor_dossier' UNION ALL SELECT 'insurance_prospector' UNION ALL
  SELECT 'ripple_effect' UNION ALL SELECT 'capital_aperture' UNION ALL SELECT 'settings'
) AS modules
WHERE NOT EXISTS (
  SELECT 1 FROM `role_module_permissions` existing
  WHERE existing.role = 'capital_operator' AND existing.module_key = modules.module_key
);
