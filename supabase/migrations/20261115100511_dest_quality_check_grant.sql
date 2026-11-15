-- dest_quality_check は service_role（シークレットキーのスクリプト）だけが読み書きする。新しい表に権限は自動で付かないので明示する
grant select, insert, update, delete on public.dest_quality_check to service_role;
