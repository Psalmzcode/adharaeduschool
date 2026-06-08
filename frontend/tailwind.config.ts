import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: { fontFamily: { display: ['Nunito','sans-serif'], body: ['Hind','sans-serif'], mono: ['monospace'] } } },
  plugins: []
}
export default config
