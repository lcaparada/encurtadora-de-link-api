CREATE TABLE `link_accesses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`link_id` bigint NOT NULL,
	`accessed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `link_accesses_id` PRIMARY KEY(`id`)
);
