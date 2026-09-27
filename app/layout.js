import localFont from 'next/font/local';
import './globals.css';
import './investment-refresh.css';
import './ui-refresh.css';
const inter = localFont({src:'../public/fonts/InterVariable.woff2',variable:'--font-inter',weight:'100 900',style:'normal',display:'swap'});
export const metadata = { title: 'Patrimônio • Seu próximo passo', description: 'Acompanhe sua carteira, aportes, dividendos e análises mensais.', manifest:'/manifest.webmanifest', icons:{icon:'/favicon.svg',apple:'/favicon.svg'}, appleWebApp:{capable:true,statusBarStyle:'default',title:'Patrimônio'} };
export const viewport = {width:'device-width', initialScale:1, themeColor:'#070a09'};
export default function RootLayout({children}) { return <html lang="pt-BR"><body className={inter.variable}>{children}</body></html> }
