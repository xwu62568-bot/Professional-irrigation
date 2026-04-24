
  # 灌溉平台设计

  This is a code bundle for 灌溉平台设计. The original project is available at https://www.figma.com/design/0crc5fJTAMgrDWAmGR3osk/%E7%81%8C%E6%BA%89%E5%B9%B3%E5%8F%B0%E8%AE%BE%E8%AE%A1.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Supabase

  Copy `.env.example` to `.env` in `web-dev` and fill:

  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

  The current `web-dev` app uses Supabase Auth for login, while the dashboard business pages still render mock data during the integration phase.

  ## GitHub Pages

  This app is configured to deploy from `web-dev` to GitHub Pages through `.github/workflows/deploy-web-dev-pages.yml`.

  Before the deployed site can log in successfully, add these repository secrets in GitHub:

  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  
