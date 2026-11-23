CREATE TABLE `guest_photos` (
	`invitation_id` text NOT NULL,
	`slot` text NOT NULL,
	`name` text NOT NULL,
	`content_type` text NOT NULL,
	`data` blob NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`invitation_id`, `slot`)
);
