// QR landing → book search → confirm (core loop). Stub.
export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  await params;
  return <h1 className="font-serif text-2xl">Check in with your book</h1>;
}
