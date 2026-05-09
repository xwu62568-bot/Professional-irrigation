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
- `migrations/20260509090000_add_mini_sessions.sql`: mini-program session persistence table

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
- `mini_sessions`

Views:

- `field_summary_view`
- `dashboard_overview_view`

RPC:

- `recalculate_field_et(p_field_id uuid, p_date date)`

## CLI usage

Run Supabase CLI commands from the repo root:

```bash
cd /Users/a511/Desktop/irrigation2.0
```

This repo can use the Supabase CLI either through a global install or through `npx`.

Examples:

```bash
supabase --version
supabase login
supabase link --project-ref <your-project-ref>
supabase db push

npx supabase --version
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

If `supabase` is installed globally but `projects list` or `db push` says `Access token not provided`, run `supabase login` again.

## Suggested next steps

1. Create a Supabase cloud project.
2. From the repo root, run `supabase login` or `npx supabase login`.
3. Link this repo to your project:

```bash
supabase link --project-ref <your-project-ref>
```

4. Push migrations:

```bash
supabase db push
```

5. After `db push`, redeploy or restart `services/execution-service`.
   The mini-program login flow now depends on the `mini_sessions` table created by `20260509090000_add_mini_sessions.sql`.

6. If you changed mini-program code, rebuild and upload the mini-program package separately.

7. Add frontend env values later in `web/.env`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Notes

- RLS is enabled on all business tables.
- Current policies assume single-user ownership, no roles yet.
- `mini_sessions` is currently used by `services/execution-service` to persist mini-program sessions across process restarts.
- ET calculation is currently a placeholder calculation:
  - `et0 = 4.20`
  - `kc = field_et_configs.kc_default`
  - `etc = et0 * kc`
- After you confirm the schema, the next step should be frontend Supabase client integration.

## Troubleshooting

- If `zsh: command not found: supabase`, either install the global CLI or use `npx supabase ...`.
- If `supabase db push` says `Access token not provided`, run `supabase login`.
- If `npx supabase ...` hits npm cache conflicts, use a dedicated cache directory:

```bash
npm_config_cache=/tmp/supabase-npm-cache npx -y supabase --version
npm_config_cache=/tmp/supabase-npm-cache npx -y supabase db push
```
