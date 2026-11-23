CREATE TABLE `game_scores` (
	`invitation_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`score` integer NOT NULL,
	`stars` integer NOT NULL,
	`cat` text NOT NULL,
	`updated_at` text NOT NULL
);
