package lat.rwa.trial;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AppPackTest {
    @Test public void nextCatchAllFolderIsNotTraversal() {
        assertFalse(AppPack.traversal("/_next/static/chunks/app/[[...rwa]]/page-9960ea3334cb744c.js"));
        assertFalse(AppPack.traversal("/media/home/hero-cool.webp"));
    }

    /** One path per folder scripts/app-pack-manifest.mjs packs; each must be served from the phone. */
    @Test public void everyPackedFolderIsServed() {
        for (String path : new String[] {
            "/_next/static/chunks/main-1a2b.js", "/icons/icon-192.png", "/brand/a-reit/mark.svg", "/auth/cabinet.webp",
            "/media/home/hero-cool.webp", "/media/home/derived/hero-640.webp", "/media/palette-a/guide/step-1.webp",
            "/media/porcelain/vase.webp", "/media/quant/cover-light.webp", "/media/referral/posters/poster-1.webp",
            "/fonts/satoshi/Satoshi-Variable.woff2", "/fonts/noto-sans-sc-app/app.woff2", "/fonts/noto-sans-sc/slice-12.woff2",
            "/avatars/professions/doctor.webp",
            "/media/products/hengxu-v2/derived/liujin-gold-720.webp",
            "/baskets/hengxu-liujin_cover.webp", "/baskets/hengxu-liujin.png", "/asset-icons/compute.png",
            "/media/generated/project-assets/solar-income-ops-v1.png", "/media/login/welcome.webp",
            "/media/brand/mark.svg", "/ai-ocr/pdf.worker.min.mjs", "/vendor/jsqr/jsQR.js",
        }) assertTrue(path, AppPack.servable(path));
    }

    @Test public void pagesApiAndOtherFoldersAreNotServed() {
        assertFalse(AppPack.servable("/api/v1/me"));
        assertFalse(AppPack.servable("/assets"));
        assertFalse(AppPack.servable("/media/desktop/hero.webp"));
        assertFalse(AppPack.servable("/media/quant/../../secret"));
        assertFalse(AppPack.servable("/download/a-reit-android-1.1.4.apk"));
    }

    @Test public void dotSegmentsAreTraversal() {
        assertTrue(AppPack.traversal("/_next/static/../../secret"));
        assertTrue(AppPack.traversal("/icons/./a.png"));
        assertTrue(AppPack.traversal("/icons/.."));
    }

    @Test public void pdfWorkerIsJavaScriptModule() {
        assertEquals("text/javascript", AppPack.mime("/ai-ocr/pdf.worker.min.mjs"));
        assertEquals("text/javascript", AppPack.mime("/vendor/jsqr/jsQR.js"));
        assertEquals("font/woff2", AppPack.mime("/fonts/noto-sans-sc/slice-12.woff2"));
    }
}
