// Tonight's shelf (F2, F3), realtime. Stub.
export default async function ShelfPage({ params }: { params: Promise<{ meetupId: string }> }) {
  await params;
  return <h1 className="font-serif text-2xl">Tonight&rsquo;s shelf</h1>;
}
