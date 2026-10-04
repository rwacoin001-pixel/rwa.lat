# Mobile polish: reused components and limits

Verified public repository metadata on 2026-10-04. Stars help select established dependencies; compatibility and licensing determine actual reuse.

| Component | Source | License | Stars at verification | Reuse |
|---|---|---|---:|---|
| Anime.js | https://github.com/juliangarnier/anime | MIT | Approximately 73,300 | Existing 4.5 engine, scoped timeline for three logo segments and a single subtle sheen. Canonical `RwaLogoMark` geometry/colors; no particles or wordmark. |
| Motion | https://github.com/motiondivision/motion | MIT | 33,817 | Existing motion dependency, composer size/shape transitions and reduced-motion behavior. |
| jsQR | https://github.com/cozmo/jsQR | Apache-2.0 | 4,037 | Existing bundled QR decoder retained for camera and gallery; its source/license are retained. |
| PDF.js | https://github.com/mozilla/pdf.js | Apache-2.0 | 53,975 | Local PDF text extraction, local worker, up to 20 pages. |
| WaveSurfer.js | https://github.com/katspaugh/wavesurfer.js | BSD-3-Clause | 10,427 (2026-10-05) | 8.0.1 live Record plugin, rounded scrolling microphone bars without an outer card; lazy loaded on voice hold. |
| Mammoth | https://github.com/mwilliamson/mammoth.js | BSD-2-Clause | 6,316 | DOCX raw text extraction after archive expansion-budget checks. |

Base UI dialogs provide focus handling, escape and portal behavior. Scanner and KYC presentation uses the existing Maison theme and the supplied visual references; no third-party product UI or branding is imported. Android dependencies and trial signing are documented separately in `android-client-trial.md`.

PDF workers are hosted under `/ai-ocr/`; legacy OCR assets remain for previous bundles. Heavy document readers load only when that type is selected. Documents send reviewed, bounded text excerpts. Images now send explicitly selected, locally resized/metadata-stripped JPEG pixels to native DeepSeek Flash for scene and software-interface recognition. Images are not stored in chat rows. Three files, 8 MiB original size per file, 12,000 document characters per file and 24,000 total are enforced; image input is bounded to 1,920 px and 384 KiB per JPEG. See `ai-input-acceptance.md` for live model evidence and remaining physical-device checks.

Startup animation is an application overlay after the operating system's static launch screen. It runs once per installed-app browser session, skips reduced motion and public desktop/auth flows, and never blocks account or market requests. The production entrance plays once; the isolated development preview repeats it for visual review. Dark mode preserves the source asset's white / `#2FE6BF`; light mode uses the existing logo component's `#0D0D0D` / `#0E8F7A` theme adaptation. A website cannot replace iOS's OS-level static launch screen with JavaScript animation.

Installed app spacing uses `env(safe-area-inset-*)` once plus compact 2/6 px air. Native WebView fits Android system bars itself. Actual iPhone safe-area and physical-device camera/voice behavior still require user device testing.
