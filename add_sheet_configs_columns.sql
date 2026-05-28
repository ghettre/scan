-- Migration script to add missing columns to sheet_configs table
-- Run this in Supabase SQL Editor if you already have the app set up

-- Add spreadsheet_url column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'sheet_configs' 
      AND column_name = 'spreadsheet_url'
  ) THEN
    ALTER TABLE public.sheet_configs 
    ADD COLUMN spreadsheet_url TEXT;
  END IF;
END $$;

-- Add is_shortcut column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'sheet_configs' 
      AND column_name = 'is_shortcut'
  ) THEN
    ALTER TABLE public.sheet_configs 
    ADD COLUMN is_shortcut BOOLEAN DEFAULT FALSE;
  END IF;
END $$;