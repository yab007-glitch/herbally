/**
 * Server-rendered JSON-LD block.
 *
 * `next/script` was used for the structured data on /herbs and
 * /symptoms/[symptom]. It injects after hydration, so those pages shipped
 * without the ItemList / MedicalWebPage block in their server HTML — only the
 * RSC payload carried it, and a crawler that does not execute JavaScript never
 * saw it at all. A plain <script type="application/ld+json"> is inert,
 * non-blocking and present in the first response, which is what Google reads.
 */
export function JsonLd({ id, data }: { id?: string; data: unknown }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
