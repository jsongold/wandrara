#!/bin/sh
# feed_entries の更新が競合しても feed_index とずれないことを、2 つのセッションで確かめる（codex 指摘）。
# 下書きの dest の地域を付け替える transaction（A）が開いている間に、同じ dest を公開する transaction（B）を走らせる。
# 使い方：DB_URL=postgresql://postgres:postgres@127.0.0.1:54399/postgres sh supabase/tests/feed_entries_race.sh   （使い捨ての DB で）
set -e
: "${DB_URL:?DB_URL を指定する（使い捨ての DB）}"
P="psql $DB_URL -At -q -v ON_ERROR_STOP=1"
D=00000000-0000-4000-8000-0000000000e1
$P <<SQL
delete from public.destinations where dest_id = '$D';
insert into public.regions (id, parent_id, name) values ('race-a', null, '{"ja":"A"}'), ('race-b', null, '{"ja":"B"}') on conflict do nothing;
insert into public.destinations (dest_id, core_type, slug, ref) values ('$D', 'accommodation', 'race-e1', 'race-e1');
insert into public.accommodations (dest_id, region_id) values ('$D', 'race-a');
insert into public.publications (dest_id, status) values ('$D', 'draft') on conflict (dest_id) do update set status = 'draft';
SQL
# A：地域を race-b に付け替え、3 秒開いたまま
$P -c "begin; update public.accommodations set region_id = 'race-b' where dest_id = '$D'; select pg_sleep(3); commit;" &
sleep 1
# B：A が開いている間に公開（A の付け替えはまだ見えない）
$P -c "update public.publications set status = 'published', published_at = now() where dest_id = '$D'"
wait
$P -c "select case when exists (select 1 from public.feed_entries where dest_id = '$D' and area_id = 'race-b') and not exists (select 1 from public.feed_entries where dest_id = '$D' and area_id = 'race-a') then 'ok: 索引は race-b' else 'NG: 索引が古い地域のまま' end"
# 2 つ目：dest_apply（destinations を先に、publications を後に書く）と、publications だけを書く公開が重なっても deadlock しない
$P -c "begin; update public.destinations set updated_at = now() where dest_id = '$D'; select pg_sleep(3); update public.publications set status = 'draft' where dest_id = '$D'; commit;" &
sleep 1
$P -c "update public.publications set published_at = now() where dest_id = '$D'"
wait
echo "ok: deadlock なし"
$P -c "delete from public.destinations where dest_id = '$D'"
