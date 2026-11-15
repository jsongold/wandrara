-- dest_quality_check は service_role だけのもの。RLS（ポリシー無し）は行の読み書きを止めるが、既定の権限（TRUNCATE など）は残るので外す
revoke all on public.dest_quality_check from anon, authenticated;
