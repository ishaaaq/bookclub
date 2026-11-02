// Shown by the service worker when a page isn't cached and there's no connection.

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-2xl">You&rsquo;re offline</h1>
      <p className="text-ink-soft">
        This page needs a connection. Pages you&rsquo;ve opened before still work, and a check-in made on a weak signal is sent as soon
        as you&rsquo;re back online.
      </p>
    </div>
  );
}
