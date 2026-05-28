-- Supabase Schema for Smart Invoice Scanner
-- Copy and paste this into the Supabase SQL Editor and click RUN

-- ==========================================
-- 1. Table: profiles (User Accounts Details)
-- ==========================================
-- Note: Supabase automatically handles the core user accounts (email, password) in the hidden 'auth.users' table.
-- We use this 'profiles' table to store extra public info like 'full_name' when a user signs up.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to automatically create a profile row for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 2. Table: user_integrations (Required for Google Sheets)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  google_access_token TEXT,
  google_refresh_token TEXT,
  spreadsheet_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own integrations" ON public.user_integrations;
CREATE POLICY "Users can view own integrations" ON public.user_integrations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own integrations" ON public.user_integrations;
CREATE POLICY "Users can insert own integrations" ON public.user_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own integrations" ON public.user_integrations;
CREATE POLICY "Users can update own integrations" ON public.user_integrations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own integrations" ON public.user_integrations;
CREATE POLICY "Users can delete own integrations" ON public.user_integrations FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 5. Table: templates
-- ==========================================
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  fields_config JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own templates" ON public.templates;
CREATE POLICY "Users can view own templates" ON public.templates FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own templates" ON public.templates;
CREATE POLICY "Users can insert own templates" ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own templates" ON public.templates;
CREATE POLICY "Users can update own templates" ON public.templates FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own templates" ON public.templates;
CREATE POLICY "Users can delete own templates" ON public.templates FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 6. Table: sheet_configs
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sheet_configs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_url TEXT,
  sheet_name TEXT NOT NULL,
  name TEXT,
  based_on_template_id TEXT,
  is_shortcut BOOLEAN DEFAULT FALSE,
  fields_config JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, spreadsheet_id, sheet_name)
);

ALTER TABLE public.sheet_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sheet configs" ON public.sheet_configs;
CREATE POLICY "Users can view own sheet configs" ON public.sheet_configs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sheet configs" ON public.sheet_configs;
CREATE POLICY "Users can insert own sheet configs" ON public.sheet_configs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sheet configs" ON public.sheet_configs;
CREATE POLICY "Users can update own sheet configs" ON public.sheet_configs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sheet configs" ON public.sheet_configs;
CREATE POLICY "Users can delete own sheet configs" ON public.sheet_configs FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- Optional Tables for Future Cloud Sync 
-- (Currently the app uses LocalStorage for these, but you can create them now for future use)
-- ==========================================

-- 3. Table: invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT,
  total_amount NUMERIC(10, 2),
  tax_amount NUMERIC(10, 2),
  tax_type TEXT,
  tax_value NUMERIC(10, 2),
  date DATE,
  category TEXT,
  status TEXT DEFAULT 'pending',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
CREATE POLICY "Users can insert own invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
CREATE POLICY "Users can update own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own invoices" ON public.invoices;
CREATE POLICY "Users can delete own invoices" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

-- 4. Table: fields_config
CREATE TABLE IF NOT EXISTS public.fields_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  field_id TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, field_id)
);

ALTER TABLE public.fields_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own fields config" ON public.fields_config;
CREATE POLICY "Users can view own fields config" ON public.fields_config FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own fields config" ON public.fields_config;
CREATE POLICY "Users can insert own fields config" ON public.fields_config FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own fields config" ON public.fields_config;
CREATE POLICY "Users can update own fields config" ON public.fields_config FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own fields config" ON public.fields_config;
CREATE POLICY "Users can delete own fields config" ON public.fields_config FOR DELETE USING (auth.uid() = user_id);

 - -   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
 - -   5 .   T a b l e :   s h e e t _ c o n f i g s 
 - -   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . s h e e t _ c o n f i g s   ( 
     i d   U U I D   D E F A U L T   g e n _ r a n d o m _ u u i d ( )   P R I M A R Y   K E Y , 
     u s e r _ i d   U U I D   R E F E R E N C E S   a u t h . u s e r s ( i d )   O N   D E L E T E   C A S C A D E   N O T   N U L L , 
     s p r e a d s h e e t _ i d   T E X T   N O T   N U L L , 
     s h e e t _ n a m e   T E X T   N O T   N U L L , 
     n a m e   T E X T , 
     b a s e d _ o n _ t e m p l a t e _ i d   T E X T , 
     f i e l d s _ c o n f i g   J S O N B   D E F A U L T   ' [ ] ' : : j s o n b , 
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) , 
     u p d a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) , 
     U N I Q U E ( u s e r _ i d ,   s p r e a d s h e e t _ i d ,   s h e e t _ n a m e ) 
 ) ; 
 
 A L T E R   T A B L E   p u b l i c . s h e e t _ c o n f i g s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 D R O P   P O L I C Y   I F   E X I S T S   " U s e r s   c a n   v i e w   o w n   s h e e t   c o n f i g s "   O N   p u b l i c . s h e e t _ c o n f i g s ; 
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   o w n   s h e e t   c o n f i g s "   O N   p u b l i c . s h e e t _ c o n f i g s   F O R   S E L E C T   U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d ) ; 
 
 D R O P   P O L I C Y   I F   E X I S T S   " U s e r s   c a n   i n s e r t   o w n   s h e e t   c o n f i g s "   O N   p u b l i c . s h e e t _ c o n f i g s ; 
 C R E A T E   P O L I C Y   " U s e r s   c a n   i n s e r t   o w n   s h e e t   c o n f i g s "   O N   p u b l i c . s h e e t _ c o n f i g s   F O R   I N S E R T   W I T H   C H E C K   ( a u t h . u i d ( )   =   u s e r _ i d ) ; 
 
 D R O P   P O L I C Y   I F   E X I S T S   " U s e r s   c a n   u p d a t e   o w n   s h e e t   c o n f i g s "   O N   p u b l i c . s h e e t _ c o n f i g s ; 
 C R E A T E   P O L I C Y   " U s e r s   c a n   u p d a t e   o w n   s h e e t   c o n f i g s "   O N   p u b l i c . s h e e t _ c o n f i g s   F O R   U P D A T E   U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d ) ; 
 
 D R O P   P O L I C Y   I F   E X I S T S   " U s e r s   c a n   d e l e t e   o w n   s h e e t   c o n f i g s "   O N   p u b l i c . s h e e t _ c o n f i g s ; 
 C R E A T E   P O L I C Y   " U s e r s   c a n   d e l e t e   o w n   s h e e t   c o n f i g s "   O N   p u b l i c . s h e e t _ c o n f i g s   F O R   D E L E T E   U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d ) ; 
 
 
