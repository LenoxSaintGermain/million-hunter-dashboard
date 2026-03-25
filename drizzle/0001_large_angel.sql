CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int,
	`type` enum('scan_completed','deal_added','deal_scored','signal_analyzed','memo_generated','outreach_sent','stage_changed','red_flag_detected','system') NOT NULL,
	`title` varchar(256) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(128),
	`source` varchar(64),
	`name` varchar(256) NOT NULL,
	`description` text,
	`industry` varchar(128),
	`location` varchar(256),
	`askingPrice` bigint,
	`revenue` bigint,
	`cashFlow` bigint,
	`ebitda` bigint,
	`multiple` float,
	`employees` int,
	`yearEstablished` int,
	`listingUrl` text,
	`stage` enum('new','scanning','qualified','high_priority','in_diligence','loi_sent','under_contract','closed','passed') NOT NULL DEFAULT 'new',
	`score` float,
	`redFlagCount` int DEFAULT 0,
	`isArchived` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int NOT NULL,
	`title` varchar(256),
	`content` text,
	`executiveSummary` text,
	`investmentThesis` text,
	`riskFactors` json,
	`aiOptimizationOpportunities` json,
	`generatedBy` varchar(64),
	`version` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outreach` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int NOT NULL,
	`contactName` varchar(256),
	`contactRole` varchar(128),
	`contactEmail` varchar(320),
	`contactPhone` varchar(32),
	`status` enum('not_contacted','email_sent','responded','call_scheduled','nda_sent','nda_signed','passed') NOT NULL DEFAULT 'not_contacted',
	`lastContactedAt` timestamp,
	`nextFollowUpAt` timestamp,
	`notes` text,
	`emailSubject` text,
	`emailBody` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outreach_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scan_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`sources` json,
	`listingsFound` int DEFAULT 0,
	`listingsQualified` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scan_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int NOT NULL,
	`ownerDistressScore` float,
	`ownerRetirementSignal` boolean,
	`ownerNegotiationStyle` varchar(64),
	`ownerProfileSummary` text,
	`techDebtScore` float,
	`digitalGrowthTrend` enum('growing','stable','declining'),
	`seoAuthorityScore` int,
	`reviewSentimentScore` float,
	`digitalAuditSummary` text,
	`killProbability` float,
	`redFlags` json,
	`redTeamSummary` text,
	`sbaEligible` boolean,
	`recommendedSbaAmount` bigint,
	`recommendedSellerNote` bigint,
	`recommendedEquity` bigint,
	`dscr` float,
	`cashOnCashReturn` float,
	`capitalStackSummary` text,
	`analyzedAt` timestamp NOT NULL DEFAULT (now()),
	`modelVersions` json,
	CONSTRAINT `signals_id` PRIMARY KEY(`id`)
);
