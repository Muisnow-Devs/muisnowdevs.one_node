INSERT INTO `labels` (`id`, `title`, `description`, `created_at`, `enabled`)
SELECT `id`, `title`, `description`, `created_at`, `enabled`
FROM `collections`;
--> statement-breakpoint
INSERT INTO `article_labels` (`article_id`, `label_id`)
SELECT `id`, `collection`
FROM `articles`
WHERE `collection` IS NOT NULL;
