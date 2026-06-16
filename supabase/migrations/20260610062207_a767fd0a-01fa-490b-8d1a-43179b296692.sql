
-- shared updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.flags ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.flags ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.flags ADD COLUMN IF NOT EXISTS resolution TEXT;

CREATE TABLE public.topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  attempts INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  mastery_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, concept)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_mastery TO authenticated;
GRANT ALL ON public.topic_mastery TO service_role;
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mastery read" ON public.topic_mastery FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Mastery insert own" ON public.topic_mastery FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "Mastery update own" ON public.topic_mastery FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE TABLE public.risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'healthy' CHECK (level IN ('healthy','attention','at_risk')),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_scores TO authenticated;
GRANT ALL ON public.risk_scores TO service_role;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Risk read" ON public.risk_scores FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Risk insert own" ON public.risk_scores FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "Risk update own" ON public.risk_scores FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE TABLE public.intervention_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('reviewed','note','assigned_revision','recommend_tutor','cleared_flag','scheduled')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_flag_id UUID REFERENCES public.flags(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_logs TO authenticated;
GRANT ALL ON public.intervention_logs TO service_role;
ALTER TABLE public.intervention_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Interventions teacher all" ON public.intervention_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Interventions student read" ON public.intervention_logs FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE INDEX intervention_logs_student_idx ON public.intervention_logs (student_id, created_at DESC);

CREATE TABLE public.recommendation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('continue','revise_topic','retry_quiz','practice','open_tutor','escalate')),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'engine' CHECK (source IN ('engine','teacher')),
  served_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  followed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_history TO authenticated;
GRANT ALL ON public.recommendation_history TO service_role;
ALTER TABLE public.recommendation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recs read" ON public.recommendation_history FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Recs insert" ON public.recommendation_history FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Recs update own" ON public.recommendation_history FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE INDEX recommendation_history_student_idx ON public.recommendation_history (student_id, served_at DESC);

CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  event TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events insert own" ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE POLICY "Events read" ON public.analytics_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') OR actor_id = auth.uid());
CREATE INDEX analytics_events_event_idx ON public.analytics_events (event, created_at DESC);

CREATE TRIGGER trg_topic_mastery_updated BEFORE UPDATE ON public.topic_mastery
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_risk_scores_updated BEFORE UPDATE ON public.risk_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
