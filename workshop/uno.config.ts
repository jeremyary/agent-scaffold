import { defineConfig } from 'unocss'

export default defineConfig({
  shortcuts: {
    'rh-red': 'text-[#EE0000]',
    'rh-black': 'text-[#151515]',
    'bg-rh-red': 'bg-[#EE0000]',
    'bg-rh-black': 'bg-[#151515]',
    'bg-pf-gray': 'bg-[#F2F2F2]',
    'text-pf-blue': 'text-[#0066CC]',
    'text-pf-green': 'text-[#3D7317]',
    'text-pf-orange': 'text-[#F5921B]',
    'font-display': 'font-[Red_Hat_Display]',
    'font-mono': 'font-[Red_Hat_Mono]',
  },
  theme: {
    colors: {
      rhRed: '#EE0000',
      rhBlack: '#151515',
      pfBlue: '#0066CC',
      pfGreen: '#3D7317',
      pfOrange: '#F5921B',
      pfDanger: '#B1380B',
      pfGray: {
        100: '#F2F2F2',
        200: '#E0E0E0',
        300: '#C7C7C7',
        400: '#A3A3A3',
        500: '#6A6E73',
        600: '#4D4D4D',
        700: '#292929',
      },
    },
  },
})
