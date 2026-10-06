import type { Metadata } from "next";

export const metadata: Metadata = { title: "Legal notice" };

// Placeholder until the legal text is written.
export default function Page() {
  return (
    <section className="view active">
      <div className="wrap blk legal">
        <h2 className="big">Legal notice</h2>
        <p>This page is being written. For questions in the meantime, use the contact form.</p>
      </div>
    </section>
  );
}
