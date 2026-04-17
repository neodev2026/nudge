CREATE OR REPLACE FUNCTION public.handle_sign_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.nv2_profiles (
    auth_user_id,
    display_name,
    avatar_url,
    email
  )
  VALUES (
    new.id::text,
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      NULL
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;