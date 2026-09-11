# Contract Compare

Contract Compare compares a software services company's standard contract with a client agreement at the clause level. It examines legal and commercial meaning, not wording alone. It identifies **Aligned**, **Modified**, **Missing**, and **Added** provisions, explains each difference, suggests an operational next step, and shows original excerpts. There is no risk scoring.

## Features

- Two accessible drag-and-drop / file-picker cards with replace and remove controls.
- PDF and DOCX extraction on the server; 10 MiB per file, 100,000 extracted characters per document, and 200 PDF pages maximum.
- All 20 requested priority topics plus other substantive provisions present in the contracts.
- Structured OpenAI output validated with Zod, status-specific evidence checks, exact source-quotation verification, derived summary counts, and one retry for invalid output.
- Real processing stages, cancellation, responsive results, Modified filter by default, and keyboard-accessible clause details with expandable quotations.
- Clear errors for missing, unsupported, empty, corrupted, protected, scanned, oversized files, unavailable API, invalid responses, interrupted connections and timeouts.
- No database, contract history, analytics, or permanent uploaded-file storage.

## Architecture

Next.js App Router, TypeScript, React, Tailwind CSS, and server-side route handlers in one project. Runtime: Node.js 22.13+ (Node 24 LTS recommended). The PDF extractor uses pdf-parse; DOCX uses Mammoth. No OCR is included.

```text
app/page.tsx                    Upload, analysis, and results state
app/api/compare/route.ts         Bounded upload + NDJSON progress/result stream
components/                     Upload, summary, filters, list, dialog, progress
lib/documents/extractDocument.ts Reusable PDF/DOCX extraction
lib/contracts/comparisonPrompt.ts Meaning-based comparison instructions
lib/contracts/comparisonSchema.ts Zod schema and source-evidence checks
lib/contracts/compareContracts.ts Server-side OpenAI Responses integration
lib/request.ts                  Bounded multipart request reading
lib/readComparisonStream.ts     Resilient client-side stream parsing
lib/limits.ts                   Shared upload validation
 tests/                         Extraction, validation and integration tests
```

The model identifies, matches and compares provisions in one request; the interface does not invent percentages or pretend to receive separate model-internal stage events. Extraction and preparation events come from actual server work. Confidence indicates matching/comparison certainty, never legal risk. Optional WebMCP support exposes only the visible summary counts when the browser supports it.

## Local setup

Install Node.js 22.13 or newer and npm, then run these commands from this directory:

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1
```

The model must support the Responses API and strict structured outputs. `OPENAI_MODEL` is optional and defaults to `gpt-4.1`. Do not prefix the key with `NEXT_PUBLIC_` or paste it into client code. Restart the server after changing environment variables.

```bash
npm run dev
```

Open http://localhost:3000. On systems with a restrictive filesystem watcher limit, use `WATCHPACK_POLLING=true npm run dev -- --webpack`.

For reproducible pnpm installs, a lockfile is included: `pnpm install --frozen-lockfile`. TypeScript is held on the supported 6.x API because the installed ESLint integration does not support TypeScript 7 yet.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

The tests exercise real DOCX/PDF extraction and the complete request/stream pipeline against a local OpenAI protocol mock. They also cover source hallucinations, invalid-output retries, safe API errors, request size checks, and missing/added evidence invariants. These tests do **not** evaluate live model accuracy. Run representative company-approved agreements through a configured model before relying on the findings. Build and tests do not require an API key.

## Deployment

### GitHub

Create a private repository. From this project directory, initialize Git, review the staged files, commit, add your repository as `origin`, and push. `.env.local`, build output and `node_modules` are ignored. Never commit contract uploads or credentials.

### Vercel

1. Import the GitHub repository into Vercel and select the Next.js preset.
2. Use this directory as the project root and choose Node.js 24.
3. Add `OPENAI_API_KEY` in **Project Settings → Environment Variables**, selecting the required environments. Optionally add `OPENAI_MODEL`.
4. Deploy. Enable deployment protection for your internal team; this MVP has no application accounts.
5. Confirm the plan supports the route's 300-second maximum duration. The app cancels model work after 270 seconds.

**Vercel upload limit:** Vercel Functions currently limit the complete request body to 4.5 MB, including both documents and multipart overhead. Keep their combined size under 4 MB on Vercel. The UI handles the resulting 413 error. The application's 10 MiB-per-file limit is available on a Node host/reverse proxy configured to accept at least 21 MiB requests. No Blob workaround is added because this MVP deliberately avoids persistent uploads. [Vercel function limits](https://vercel.com/docs/functions/limitations).

For a full-size internal deployment, use a Node server with `npm run build` and `npm start`, a proxy upload limit of at least 21 MiB, streaming enabled, and a request timeout above 300 seconds. Place the service behind your organization's access gateway. The process-local limit of two concurrent comparisons bounds work in a single instance; it is not global rate limiting or authentication. Configure gateway rate limits and API spending limits before exposing the endpoint beyond a trusted team.

This is a real Next.js Node application. It is not a static export or a Cloudflare Worker build; do not deploy only the frontend, because comparison requires the server route.

## Privacy note

Uploaded files and extracted text are processed in request memory. The app does not save them to disk, a database, browser storage, or public directories. It does not log full documents, filenames, model output, or provider exception payloads. Results remain in the current page's memory until reset/reload; the response has `Cache-Control: no-store`. Files are released after processing; JavaScript garbage collection does not guarantee immediate secure memory erasure.

Extracted text is transmitted to OpenAI for the comparison. Requests set `store: false`; this does not itself guarantee zero provider retention. Your OpenAI account's applicable data controls and policies govern processing. Host/proxy logging should also exclude request and response bodies. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## Limitations

- Only text-based PDFs; scanned/image-only PDFs return an explicit OCR error. Mixed scanned/text PDFs can omit image-only content, so check the original document.
- Complex PDF columns, tables, headers, footnotes, DOCX text boxes and tracked changes may not extract in the intended order. Review these documents manually and use clean, accepted-change versions where possible.
- Whole-document limits avoid silent truncation; oversized extracted text is rejected.
- Source matching proves that a quotation exists, not that the model's interpretation or coverage is correct. Human review is required, especially for low confidence or referenced exhibits not supplied.
- Operational suggestions are not legal advice.
- No accounts, contract history, database, OCR, redlining, or risk scoring in this MVP.
- Local rendering/build and mock integration can be verified without credentials; live model behavior requires your server-side API key.

## Implementation references

[Next.js App Router](https://nextjs.org/docs/app/getting-started/installation) · [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
