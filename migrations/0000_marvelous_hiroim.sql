CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(128) NOT NULL,
	`description` varchar(512) NOT NULL,
	`content` text NOT NULL,
	`collection` varchar(32) NOT NULL,
	`comment` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`enabled` boolean NOT NULL DEFAULT true,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_title_unique` UNIQUE(`title`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` varchar(32) NOT NULL,
	`title` varchar(64) NOT NULL,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`enabled` boolean NOT NULL DEFAULT true,
	CONSTRAINT `collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `collections_title_unique` UNIQUE(`title`)
);
--> statement-breakpoint
CREATE TABLE `downloadable_file` (
	`id` varchar(36) NOT NULL,
	`filename` varchar(64) NOT NULL,
	`original_filename` varchar(36) NOT NULL,
	`file_image` varchar(40),
	`file_type` varchar(128) NOT NULL DEFAULT 'application/octet-stream',
	`file_size` int NOT NULL DEFAULT 0,
	`hash` varchar(40),
	`s3` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`enabled` boolean NOT NULL DEFAULT true,
	CONSTRAINT `downloadable_file_id` PRIMARY KEY(`id`),
	CONSTRAINT `downloadable_file_filename_unique` UNIQUE(`filename`),
	CONSTRAINT `downloadable_file_original_filename_unique` UNIQUE(`original_filename`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(64) NOT NULL,
	`title` varchar(64) NOT NULL,
	`description` varchar(120) NOT NULL,
	`content` text NOT NULL,
	`additional_link` text NOT NULL,
	`image` varchar(36),
	`download_link` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`enabled` boolean NOT NULL DEFAULT true,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_title_unique` UNIQUE(`title`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_collection_collections_id_fk` FOREIGN KEY (`collection`) REFERENCES `collections`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `articles_collection_idx` ON `articles` (`collection`);--> statement-breakpoint
CREATE INDEX `downloadable_files_filename_idx` ON `downloadable_file` (`filename`);--> statement-breakpoint
CREATE INDEX `downloadable_files_original_filename_idx` ON `downloadable_file` (`original_filename`);--> statement-breakpoint
CREATE INDEX `downloadable_files_hash_idx` ON `downloadable_file` (`hash`);--> statement-breakpoint
CREATE INDEX `projects_title_idx` ON `projects` (`title`);