import type { Metadata } from "next";
import { DeviceSetting } from "@/components/gallery/Lightbox";
import { Company, ContactUs, UPDATED, ticketSellers } from "@/components/legal";
import { getGlobal } from "@/lib/server";

export const metadata: Metadata = { title: "Privacy" };

export default async function Page() {
  const { site, cities } = await getGlobal();
  return (
    <section className="view active">
      <div className="wrap blk legal">
        <h2 className="big">Privacy</h2>
        <p className="mono">Last updated {UPDATED}</p>
        <p>
          This explains what House of Young collects through this website, why, who else handles it and what you can ask us to do. We collect as little as we can and
          never sell your data.
        </p>

        <h3>Who we are</h3>
        <p>
          House of Young is responsible for your data (the &ldquo;controller&rdquo;). For anything about your data, <ContactUs site={site} />.
        </p>
        <Company site={site} />

        <h3 id="community">The community list</h3>
        <p>
          When you join the list we store your name and email and, if you give them, your phone or WhatsApp number, city and Instagram handle. We also store how you
          want to hear from us (email, WhatsApp or both), what you&rsquo;re interested in (events, talent opportunities, business collaborations, merch drops) and when
          you agreed to hear from us.
        </p>
        <p>
          We use these details only to send you House of Young news the way you chose. We do this with your consent, which you can withdraw at any time: reply to any
          message or contact us. When you unsubscribe we stop messaging you and note the date so we don&rsquo;t contact you again. If you ask us to delete your
          details, we remove them completely.
        </p>

        <h3 id="enquiries">Booking requests and messages</h3>
        <p>
          When you book talent or send us a message, we store what you enter: your name (and company, for bookings), email or phone, city and the details of your
          request, such as the event date, place, type and audience size, or your subject and message. The team adds the status of your enquiry and internal notes.
          A copy is emailed to the House of Young team, and we email you a confirmation.
        </p>
        <p>
          We use this to answer you and, for bookings, to arrange the booking you asked about: steps you asked us to take, and our legitimate interest in replying to
          messages. We delete enquiries 24 months after they arrive.
        </p>

        <h3 id="music">Music answers</h3>
        <p>
          When you buy tickets, or scan the QR code at one of our events, you can tell us up to three favourite genres, a favourite artist and a song you&rsquo;d like
          to hear. It&rsquo;s optional, and we don&rsquo;t ask for your name or contact details. Your browser keeps a random code so you can change your answer later;
          the code doesn&rsquo;t identify you.
        </p>
        <p>
          Answers are shared with the House of Young team and that night&rsquo;s DJs to plan the music, and help us see what each city likes over time. The share of
          each genre may be shown on the site; artist names and song requests are never shown publicly.
        </p>

        <h3 id="gallery">Gallery stats</h3>
        <p>
          When you open or download a gallery photo we count it, so we know which nights and photos people love. We store the photo, the time and a code made from your
          connection and browser that changes every day. It lets us count unique visitors without knowing who you are or following you from one day to the next.
        </p>
        <p>
          If you allow it, we also store a code for this device, made from its settings (such as screen size, language and time zone). It never includes your name or
          contact details and we use it only to see how many people come back to the gallery. You can change your choice here at any time.
        </p>
        <DeviceSetting />

        <h3 id="photos">Photos and videos from our events</h3>
        <p>
          We photograph and film our events and publish some of it in the gallery and on our social media. If you&rsquo;re in a photo and want it taken down, send
          us the link and we&rsquo;ll remove it from the gallery. To reach us, <ContactUs site={site} />.
        </p>

        <h3 id="cookies">Cookies and browser storage</h3>
        <p>
          The site sets one cookie, <code>hoy_city</code>, which remembers the city you picked for a year. Your browser also keeps your answer to the gallery device
          question and, if you share music answers, the random code described above. That&rsquo;s all: the site uses no analytics or advertising cookies and has no
          third-party trackers, so there&rsquo;s no cookie banner. The team&rsquo;s Studio uses sign-in cookies for staff only.
        </p>

        <h3 id="services">Services we use</h3>
        <p>
          Railway hosts the website and its server in its EU region. Supabase stores the database and uploaded photos and media in Paris, in the EU. Resend delivers
          the site&rsquo;s emails, such as enquiry notifications and confirmations. Sentry receives the server&rsquo;s error reports, only when error monitoring
          is switched on; it receives no IP addresses or cookies. They handle data only on our behalf. Where any of them may access data from outside the EU, the
          transfer is covered by the European Commission&rsquo;s standard contractual clauses.
        </p>

        <h3 id="tickets">Ticket sellers</h3>
        <p>
          Tickets are sold by {ticketSellers(cities)}. When you buy a ticket you do it on their site, and they handle your purchase and its personal data as a separate
          controller under their own terms and privacy policy. We never see your card details.
        </p>

        <h3 id="rights">Your rights</h3>
        <p>
          You can ask us for a copy of the data we hold about you, to correct it, to delete it, to stop or limit using it (objection and restriction), and to receive
          it in a common format to take elsewhere (portability). Where we rely on your consent you can withdraw it at any time. To do any of this,{" "}
          <ContactUs site={site} />. We&rsquo;ll reply within a month. Music answers and gallery stats are anonymous, so we can&rsquo;t link them to you.
        </p>

        <h3 id="complaints">Complaints</h3>
        <p>
          If you&rsquo;re unhappy with how we handle your data, please tell us first so we can put it right. You can also complain to a data protection authority: in
          Spain, the Agencia Española de Protección de Datos (
          <a href="https://www.aepd.es" target="_blank" rel="noopener">
            aepd.es
          </a>
          ); in Nigeria, the Nigeria Data Protection Commission (
          <a href="https://ndpc.gov.ng" target="_blank" rel="noopener">
            ndpc.gov.ng
          </a>
          ).
        </p>

        <h3>Changes</h3>
        <p>If we change this policy we&rsquo;ll update this page and the date at the top.</p>
      </div>
    </section>
  );
}
