ALTER TABLE plan_settings ADD COLUMN IF NOT EXISTS annual_client_target INT DEFAULT 30;
ALTER TABLE plan_settings ADD COLUMN IF NOT EXISTS annual_project_target INT DEFAULT 250;