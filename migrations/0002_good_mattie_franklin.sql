CREATE TABLE `article_labels` (
	`article_id` int NOT NULL,
	`label_id` varchar(32) NOT NULL,
	CONSTRAINT `article_labels_article_id_label_id_pk` PRIMARY KEY(`article_id`,`label_id`)
);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` varchar(32) NOT NULL,
	`title` varchar(64) NOT NULL,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`enabled` boolean NOT NULL DEFAULT true,
	CONSTRAINT `labels_id` PRIMARY KEY(`id`),
	CONSTRAINT `labels_title_unique` UNIQUE(`title`)
);
--> statement-breakpoint
ALTER TABLE `articles` MODIFY COLUMN `collection` varchar(32);--> statement-breakpoint
ALTER TABLE `article_labels` ADD CONSTRAINT `article_labels_article_id_articles_id_fk` FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `article_labels` ADD CONSTRAINT `article_labels_label_id_labels_id_fk` FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `article_labels_label_idx` ON `article_labels` (`label_id`);
