CREATE TABLE `argo_collocations` (
	`id` varchar(64) NOT NULL,
	`run_id` varchar(64) NOT NULL,
	`float_id` varchar(64) NOT NULL,
	`observed_at` timestamp NOT NULL,
	`latitude` varchar(32) NOT NULL,
	`longitude` varchar(32) NOT NULL,
	`overall_rmse` varchar(32) NOT NULL,
	`overall_bias` varchar(32) NOT NULL,
	`correlation` varchar(32) NOT NULL,
	`metrics_by_depth_band` json NOT NULL,
	`artifact_id` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `argo_collocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `artifact_refs` (
	`id` varchar(64) NOT NULL,
	`run_id` varchar(64) NOT NULL,
	`kind` enum('source_subset','opencv_layer','model_artifact','validation_extract','reproducibility_bundle','evidence_snapshot') NOT NULL,
	`object_key` varchar(512) NOT NULL,
	`public_url` varchar(1024),
	`sha256` varchar(64) NOT NULL,
	`content_type` varchar(160) NOT NULL,
	`byte_size` int NOT NULL,
	`provenance` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifact_refs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitored_regions` (
	`id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`bounds` json NOT NULL,
	`heat_fuel_threshold` varchar(32) NOT NULL,
	`uncertainty_threshold` varchar(32) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitored_regions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ocean_runs` (
	`id` varchar(64) NOT NULL,
	`status` enum('queued','processing','completed','degraded','failed') NOT NULL,
	`as_of` timestamp NOT NULL,
	`region_name` varchar(120) NOT NULL,
	`source_manifest_key` varchar(512) NOT NULL,
	`dataset_version` varchar(120) NOT NULL,
	`model_version` varchar(120) NOT NULL,
	`code_version` varchar(120) NOT NULL,
	`confidence` enum('high','moderate','limited','insufficient') NOT NULL,
	`fallback_mode` enum('none','selective_climatology','full_climatology','human_review') NOT NULL,
	`schedule_cron_task_uid` varchar(65),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `ocean_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qa_traces` (
	`id` varchar(64) NOT NULL,
	`run_id` varchar(64) NOT NULL,
	`sequence` int NOT NULL,
	`trigger_type` enum('cloud_gap','front_discontinuity','uncertainty_cluster','validation_divergence') NOT NULL,
	`action` enum('reprocess_inpainting','selective_climatology','request_human_review','accept_scene') NOT NULL,
	`rationale` text NOT NULL,
	`evidence` json NOT NULL,
	`before_metrics` json NOT NULL,
	`after_metrics` json,
	`human_reviewer` varchar(128),
	`state` enum('detected','actioned','accepted','escalated') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qa_traces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `threshold_alerts` (
	`id` varchar(64) NOT NULL,
	`run_id` varchar(64) NOT NULL,
	`monitored_region_id` varchar(64) NOT NULL,
	`type` enum('heat_fuel','uncertainty','combined') NOT NULL,
	`severity` enum('watch','review','high') NOT NULL,
	`evidence_artifact_id` varchar(64) NOT NULL,
	`qa_trace_id` varchar(64) NOT NULL,
	`delivery_state` enum('pending','delivered','failed') NOT NULL,
	`delivered_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `threshold_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `argo_collocations_run_idx` ON `argo_collocations` (`run_id`);--> statement-breakpoint
CREATE INDEX `argo_collocations_float_idx` ON `argo_collocations` (`float_id`);--> statement-breakpoint
CREATE INDEX `artifact_refs_run_idx` ON `artifact_refs` (`run_id`);--> statement-breakpoint
CREATE INDEX `artifact_refs_kind_idx` ON `artifact_refs` (`kind`);--> statement-breakpoint
CREATE INDEX `ocean_runs_as_of_idx` ON `ocean_runs` (`as_of`);--> statement-breakpoint
CREATE INDEX `ocean_runs_schedule_task_idx` ON `ocean_runs` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `qa_traces_run_idx` ON `qa_traces` (`run_id`);--> statement-breakpoint
CREATE INDEX `threshold_alerts_run_idx` ON `threshold_alerts` (`run_id`);--> statement-breakpoint
CREATE INDEX `threshold_alerts_region_idx` ON `threshold_alerts` (`monitored_region_id`);