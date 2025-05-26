CREATE TABLE `links` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`urlCode` varchar(20) NOT NULL,
	`original_url` varchar(2048) NOT NULL,
	`short_url` varchar(2048) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`access_count` int DEFAULT 0,
	`ip` varchar(45) NOT NULL,
	CONSTRAINT `links_id` PRIMARY KEY(`id`),
	CONSTRAINT `links_urlCode_unique` UNIQUE(`urlCode`)
);
