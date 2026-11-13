import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={
  title:"PLAIONN Hockey",
  robots:{index:false,follow:false},
  description:"Your league, your teams, and every moment on the ice.",
  manifest: "/manifest.json",
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="en"><body>{children}</body></html>;
}
