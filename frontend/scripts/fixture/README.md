Mock House of Young API for screenshotting the frontend next to reference/prototype.html with the same content and images.
Run from the frontend dir: `node scripts/fixture/make-art.mjs && node scripts/mock-api.mjs` (art PNGs go to scripts/fixture/art/, the server listens on PORT, default 8019).
make-art.mjs uses the frontend's Playwright devDependency (run `npx playwright install chromium` once). The PNGs are generated, not committed.
Point the frontend at it: `NEXT_PUBLIC_API_URL=http://127.0.0.1:8019/api/v1 npm run dev` (or `build && start`).
Content comes from scripts/fixture/data.mjs (the prototype's D object converted to API shapes); images are the prototype's field() canvas art, drawn with the same seeds.
Test hooks: send `X-Mock-Throttle: 1` on an enquiry POST for a 429; reads honour ?city=, ?when=past|upcoming|all, ?featured=1.
