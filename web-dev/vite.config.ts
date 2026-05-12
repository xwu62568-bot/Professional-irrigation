import { defineConfig } from 'vite'
import path from 'path'
import { createRequire } from 'module'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)
const aiAssistantConfig = require('../config/ai-assistant.js')
const repoName = 'Professional-irrigation'
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const githubRepository = process.env.GITHUB_REPOSITORY?.split('/')[1] || repoName
const publicBase = process.env.VITE_PUBLIC_BASE || (isGitHubActions ? `/${githubRepository}/` : '/')
const aiAssistantChatbotUrl =
  process.env[aiAssistantConfig.chatbotEnvVarName] || aiAssistantConfig.defaultChatbotUrl

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  base: publicBase,
  define: {
    __WEB_AI_ASSISTANT_CHATBOT_URL__: JSON.stringify(aiAssistantChatbotUrl),
    __WEB_AI_ASSISTANT_MINI_PAGE_ROUTE__: JSON.stringify(aiAssistantConfig.miniProgramPageRoute),
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
