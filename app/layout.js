import './globals.css';
export const metadata = { title: 'Patrimônio • Seu próximo passo', description: 'Acompanhe sua carteira, aportes, dividendos e análises mensais.', manifest:'/manifest.webmanifest', icons:{icon:'/favicon.svg',apple:'/icon-192.png'}, appleWebApp:{capable:true,statusBarStyle:'default',title:'Patrimônio'} };
export const viewport = {width:'device-width', initialScale:1, themeColor:'#142f29'};
export default function RootLayout({children}) { return <html lang="pt-BR"><body>{children}</body></html> }
