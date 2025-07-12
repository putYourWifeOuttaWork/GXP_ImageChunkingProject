-- Add foreign key relationships for partitioned tables
-- This helps PostgREST understand the relationships between partitioned tables and other tables

-- First, let's check if the constraints already exist
DO $$
BEGIN
    -- Add foreign key for petri_observations_partitioned -> submissions
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'petri_observations_partitioned_submission_id_fkey'
        AND table_name = 'petri_observations_partitioned'
    ) THEN
        ALTER TABLE petri_observations_partitioned
        ADD CONSTRAINT petri_observations_partitioned_submission_id_fkey
        FOREIGN KEY (submission_id) REFERENCES submissions(submission_id);
    END IF;

    -- Add foreign key for petri_observations_partitioned -> pilot_programs
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'petri_observations_partitioned_program_id_fkey'
        AND table_name = 'petri_observations_partitioned'
    ) THEN
        ALTER TABLE petri_observations_partitioned
        ADD CONSTRAINT petri_observations_partitioned_program_id_fkey
        FOREIGN KEY (program_id) REFERENCES pilot_programs(program_id);
    END IF;

    -- Add foreign key for petri_observations_partitioned -> sites
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'petri_observations_partitioned_site_id_fkey'
        AND table_name = 'petri_observations_partitioned'
    ) THEN
        ALTER TABLE petri_observations_partitioned
        ADD CONSTRAINT petri_observations_partitioned_site_id_fkey
        FOREIGN KEY (site_id) REFERENCES sites(site_id);
    END IF;

    -- Add foreign key for gasifier_observations_partitioned -> submissions
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'gasifier_observations_partitioned_submission_id_fkey'
        AND table_name = 'gasifier_observations_partitioned'
    ) THEN
        ALTER TABLE gasifier_observations_partitioned
        ADD CONSTRAINT gasifier_observations_partitioned_submission_id_fkey
        FOREIGN KEY (submission_id) REFERENCES submissions(submission_id);
    END IF;

    -- Add foreign key for gasifier_observations_partitioned -> pilot_programs
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'gasifier_observations_partitioned_program_id_fkey'
        AND table_name = 'gasifier_observations_partitioned'
    ) THEN
        ALTER TABLE gasifier_observations_partitioned
        ADD CONSTRAINT gasifier_observations_partitioned_program_id_fkey
        FOREIGN KEY (program_id) REFERENCES pilot_programs(program_id);
    END IF;

    -- Add foreign key for gasifier_observations_partitioned -> sites
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'gasifier_observations_partitioned_site_id_fkey'
        AND table_name = 'gasifier_observations_partitioned'
    ) THEN
        ALTER TABLE gasifier_observations_partitioned
        ADD CONSTRAINT gasifier_observations_partitioned_site_id_fkey
        FOREIGN KEY (site_id) REFERENCES sites(site_id);
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';