import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <section className="flex flex-col items-center text-center max-w-3xl">
        <h1 className="heading text-4xl md:text-6xl">Build your Career</h1>
        <p className="subheading mt-4 max-w-2xl text-lg md:text-xl">Turn your professional growth into a quest-driven adventure.</p>
        <div className="mt-8 flex gap-4">
          <Link to="/login" className="btn-primary text-lg px-6 py-3">Get Started</Link>
        </div>
      </section>
    </div>
  );
}


