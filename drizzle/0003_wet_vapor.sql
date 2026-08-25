CREATE TABLE `ocean_run_payloads` (
	`id` varchar(64) NOT NULL,
	`run_id` varchar(64) NOT NULL,
	`reconstruction_profile` json NOT NULL,
	`uncertainty_profile` json NOT NULL,
	`decision` json NOT NULL,
	`validation_summary` json NOT NULL,
	`qa_snapshot` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ocean_run_payloads_id` PRIMARY KEY(`id`),
	CONSTRAINT `ocean_run_payloads_run_id_unique` UNIQUE(`run_id`)
);
--> statement-breakpoint
CREATE INDEX `ocean_run_payloads_run_idx` ON `ocean_run_payloads` (`run_id`);