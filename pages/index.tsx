import Head from 'next/head';
import NavBar from '@/components/NavBar';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import Footer from '@/components/Footer';

/** Public landing page. */
export default function Home() {
  return (
    <>
      <Head>
        <title>KaamSetu: bridge your degree to your first job</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <NavBar />
      <main>
        <Hero />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
