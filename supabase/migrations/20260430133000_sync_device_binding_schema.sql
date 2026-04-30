alter table if exists public.zone_device_bindings
  add column if not exists switch_status text;

update public.zone_device_bindings
set switch_status = 'unknown'
where switch_status is null;

alter table if exists public.zone_device_bindings
  alter column switch_status set default 'unknown';

alter table if exists public.zone_device_bindings
  alter column switch_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'zone_device_bindings_switch_status_check'
      and conrelid = 'public.zone_device_bindings'::regclass
  ) then
    alter table public.zone_device_bindings
      add constraint zone_device_bindings_switch_status_check
      check (switch_status in ('open', 'closed', 'unknown', 'none'));
  end if;
end
$$;
