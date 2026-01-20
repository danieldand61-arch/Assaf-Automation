-- =============================================
-- AUTO-CREATE DEFAULT ACCOUNT ON USER SIGNUP
-- =============================================

-- Function to create default account for new user
CREATE OR REPLACE FUNCTION public.create_default_account_for_user()
RETURNS TRIGGER AS $$
DECLARE
    new_account_id UUID;
    account_name TEXT;
BEGIN
    -- Get account name from metadata or email
    account_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
    ) || ' Account';
    
    -- Insert default account
    INSERT INTO public.accounts (user_id, name, description)
    VALUES (
        NEW.id,
        account_name,
        'Default account'
    )
    RETURNING id INTO new_account_id;
    
    -- Set as active account in user_settings
    INSERT INTO public.user_settings (user_id, active_account_id)
    VALUES (
        NEW.id,
        new_account_id
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Failed to create default account for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;

-- Trigger to run after user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_account_for_user();
