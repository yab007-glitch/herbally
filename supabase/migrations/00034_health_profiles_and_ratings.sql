-- Profiles: store user health info for personalized recommendations
CREATE TABLE IF NOT EXISTS public.health_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id TEXT,
  medications TEXT[] DEFAULT '{}',
  allergies TEXT[] DEFAULT '{}',
  conditions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT health_profiles_owner CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_health_profiles_user ON public.health_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_health_profiles_guest ON public.health_profiles(guest_id);

ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.health_profiles FOR ALL USING (auth.uid() = user_id);

-- Ratings: community reviews for herbs
CREATE TABLE IF NOT EXISTS public.herb_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  herb_slug TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  experience TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT herb_ratings_owner CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_herb_ratings_slug ON public.herb_ratings(herb_slug);
CREATE INDEX IF NOT EXISTS idx_herb_ratings_user ON public.herb_ratings(user_id);

ALTER TABLE public.herb_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ratings" ON public.herb_ratings FOR SELECT USING (true);
CREATE POLICY "Users manage own ratings" ON public.herb_ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own ratings" ON public.herb_ratings FOR UPDATE USING (auth.uid() = user_id OR guest_id = current_setting('app.guest_id', true));

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  locale TEXT DEFAULT 'en',
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
