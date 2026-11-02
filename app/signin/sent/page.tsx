import Link from "next/link";

export default function SentPage() {
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-2xl">Check your email</h1>
      <p role="status" className="text-ink-soft">
        We sent you a sign-in link. Open it on this phone. <Link href="/signin" className="text-binding underline">Use a different email</Link>
      </p>
    </div>
  );
}
