import type { Metadata } from "next";
import { DeviceSetting } from "@/components/gallery/Lightbox";

export const metadata: Metadata = { title: "Privacy" };

// Placeholder until the legal text is written; the gallery section describes what the site does today.
export default function Page() {
  return (
    <section className="view active">
      <div className="wrap blk legal">
        <h2 className="big">Privacy</h2>
        <p>This page is being written. For questions in the meantime, use the contact form.</p>
        <h3 id="gallery" style={{ marginTop: "48px" }}>
          Gallery stats
        </h3>
        <p>
          When you open or download a gallery photo we count it, so we know which nights and photos people love. We store the photo, the time and a code made from your
          connection and browser that changes every day. It lets us count unique visitors without knowing who you are or following you from one day to the next.
        </p>
        <p>
          If you allow it, we also store a code for this device, made from its settings (such as screen size, language and time zone). It never includes your name or
          contact details and we use it only to see how many people come back to the gallery. You can change your choice here at any time.
        </p>
        <DeviceSetting />
      </div>
    </section>
  );
}
