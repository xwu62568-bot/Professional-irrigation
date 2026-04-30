alter table if exists public.irrigation_devices
  add column if not exists sensor_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'irrigation_devices_sensor_type_check'
      and conrelid = 'public.irrigation_devices'::regclass
  ) then
    alter table public.irrigation_devices
      add constraint irrigation_devices_sensor_type_check
      check (sensor_type in ('soil_moisture', 'rainfall', 'temperature', 'weather'));
  end if;
end
$$;
