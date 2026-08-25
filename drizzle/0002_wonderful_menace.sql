CREATE TABLE `pipeline_configs` (
	`id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`region_name` varchar(120) NOT NULL,
	`cron_expression` varchar(64) NOT NULL,
	`schedule_cron_task_uid` varchar(65),
	`enabled` int NOT NULL DEFAULT 0,
	`data_source_status` enum('unconfigured','ready','degraded') NOT NULL DEFAULT 'unconfigured',
	`model_endpoint_status` enum('unconfigured','ready','degraded') NOT NULL DEFAULT 'unconfigured',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipeline_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pipeline_configs_schedule_task_idx` ON `pipeline_configs` (`schedule_cron_task_uid`);