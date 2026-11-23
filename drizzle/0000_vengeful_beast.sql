CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`group_name` text NOT NULL,
	`group_key` text NOT NULL,
	`token` text NOT NULL,
	`guests` text NOT NULL,
	`plus_one` integer NOT NULL,
	`companion` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_group_key_unique` ON `invitations` (`group_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);--> statement-breakpoint
CREATE TABLE `wedding_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`settings` text NOT NULL
);
