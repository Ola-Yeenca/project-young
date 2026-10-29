import Image from "next/image";
import mark from "@/public/hoy-mark.jpg";

// Static shell shown while the first city's data streams in: same shapes as the real page.
export function ShellSkeleton() {
  return (
    <>
      <header>
        <div className="wrap bar">
          <span className="brand">
            <span className="m">
              <Image src={mark} alt="" width={34} height={34} priority />
            </span>
            <span className="w">House of Young</span>
          </span>
        </div>
      </header>
      <main>
        <div className="hero">
          <div className="wrap">
            <div className="platter" style={{ animation: "none" }}>
              <div className="sk sk-disc"></div>
            </div>
          </div>
        </div>
        <div className="wrap blk">
          <div className="idx">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="sk-row"></div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

/** Grey rows in the .idx shape, for lists still loading. */
export function RowsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-row"></div>
      ))}
    </>
  );
}
