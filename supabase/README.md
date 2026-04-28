# Supabase Backend Scaffold

This directory contains the first-pass Supabase backend scaffold for the irrigation business backend.

## Scope

Current MVP only covers business data:

- Auth / profile
- Fields and zones
- Irrigation plans
- Automation strategies
- ET config and ET daily data

Not included yet:

- Device access
- MQTT integration
- Rule engine
- Auto execution
- Alarm center

## Files

- `config.toml`: local Supabase CLI config
- `migrations/20260423160000_init_irrigation_business_backend.sql`: initial schema

## Main objects

Tables:

- `profiles`
- `fields`
- `field_zones`
- `irrigation_plans`
- `irrigation_plan_zones`
- `automation_strategies`
- `field_et_configs`
- `field_et_daily`

Views:

- `field_summary_view`
- `dashboard_overview_view`

RPC:

- `recalculate_field_et(p_field_id uuid, p_date date)`

## CLI usage

This repo can use the Supabase CLI through `npx`, so a global install is not required.

Examples:

```bash
npx supabase --version
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## Suggested next steps

1. Create a Supabase cloud project.
2. Run `npx supabase login`.
3. Link this repo to your project:

```bash
npx supabase link --project-ref <your-project-ref>
```

4. Push migrations:

```bash
npx supabase db push
```

5. Add frontend env values later in `web/.env`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Notes

- RLS is enabled on all business tables.
- Current policies assume single-user ownership, no roles yet.
- ET calculation is currently a placeholder calculation:
  - `et0 = 4.20`
  - `kc = field_et_configs.kc_default`
  - `etc = et0 * kc`
- After you confirm the schema, the next step should be frontend Supabase client integration.
