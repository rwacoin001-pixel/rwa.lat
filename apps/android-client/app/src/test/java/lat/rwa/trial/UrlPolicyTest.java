package lat.rwa.trial;

import org.junit.Test;
import static org.junit.Assert.*;

public class UrlPolicyTest {
    @Test public void onlyExactHttpsSiteStaysInside() {
        assertEquals(UrlPolicy.Destination.INTERNAL, UrlPolicy.destination("https://rwa.lat/home"));
        assertEquals(UrlPolicy.Destination.INTERNAL, UrlPolicy.destination("https://RWA.LAT:443/ai-assistant"));
        assertFalse(UrlPolicy.trustedOrigin("https://rwa.lat.evil.test"));
        assertFalse(UrlPolicy.trustedOrigin("https://evil.test/rwa.lat"));
        assertFalse(UrlPolicy.trustedOrigin("https://rwa.lat@evil.test"));
        assertFalse(UrlPolicy.trustedOrigin("https://rwa.lat:8443"));
        assertFalse(UrlPolicy.trustedOrigin("http://rwa.lat"));
        assertFalse(UrlPolicy.trustedOrigin("https://api.rwa.lat"));
        assertFalse(UrlPolicy.trustedOrigin("https://rwa.lat."));
    }
    @Test public void authNeverOpensInEmbeddedBrowser() {
        assertEquals(UrlPolicy.Destination.BROWSER_AUTH, UrlPolicy.destination("https://accounts.google.com/o/oauth2/auth?state=opaque"));
        assertEquals(UrlPolicy.Destination.BROWSER_AUTH, UrlPolicy.destination("https://api.x.com/oauth/authorize?oauth_token=opaque"));
        assertEquals(UrlPolicy.Destination.BROWSER_AUTH, UrlPolicy.destination("https://rwa.lat/__native/browser-login"));
        assertEquals(UrlPolicy.Destination.BROWSER_AUTH, UrlPolicy.destination("https://rwa.lat/auth/passkey"));
    }
    @Test public void blocksUnsafeSchemesCredentialsAndInvalidUrls() {
        for (String url : new String[]{"http://rwa.lat", "javascript:alert(1)", "file:///sdcard/a", "content://private/file", "intent://x", "https://user@rwa.lat/", "https://rwa.lat:bad/", "https://x.test/?sessionToken=secret", "https://x.test/#access_token=secret", "https://x.test/?auth_token=secret", null}) {
            assertEquals(url, UrlPolicy.Destination.BLOCK, UrlPolicy.destination(url));
        }
    }
    @Test public void downloadDoesNotLeakSessionsToOtherHosts() {
        assertTrue(UrlPolicy.trustedDownload("https://rwa.lat/documents/terms.pdf"));
        assertTrue(UrlPolicy.trustedDownload("https://api.rwa.lat/public/document.pdf"));
        assertFalse(UrlPolicy.trustedDownload("https://api.rwa.lat/?access_token=secret"));
        assertFalse(UrlPolicy.trustedDownload("https://evil.test/file.pdf"));
        assertFalse(UrlPolicy.trustedDownload("blob:https://rwa.lat/random"));
    }
    @Test public void browserPageStripsCredentialsAndEveryQuery() {
        assertEquals("https://rwa.lat/markets", UrlPolicy.safeBrowserPage("https://rwa.lat/markets?token=secret#session"));
        assertEquals("https://rwa.lat/login", UrlPolicy.safeBrowserPage("https://rwa.lat/auth/callback/google?code=opaque"));
        assertEquals("https://rwa.lat/home", UrlPolicy.safeBrowserPage("https://evil.test/"));
    }
}
