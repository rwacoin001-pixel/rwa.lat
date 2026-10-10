package lat.rwa.trial;

import org.junit.Test;
import static org.junit.Assert.*;

public class UrlPolicyTest {
    @Test public void onlyExactHttpsSiteStaysInside() {
        assertEquals(UrlPolicy.Destination.INTERNAL, UrlPolicy.destination("https://a-reit.com/home"));
        assertEquals(UrlPolicy.Destination.INTERNAL, UrlPolicy.destination("https://A-REIT.COM:443/ai-assistant"));
        assertFalse(UrlPolicy.trustedOrigin("https://a-reit.com.evil.test"));
        assertFalse(UrlPolicy.trustedOrigin("https://evil.test/a-reit.com"));
        assertFalse(UrlPolicy.trustedOrigin("https://a-reit.com@evil.test"));
        assertFalse(UrlPolicy.trustedOrigin("https://a-reit.com:8443"));
        assertFalse(UrlPolicy.trustedOrigin("http://a-reit.com"));
        assertFalse(UrlPolicy.trustedOrigin("https://api.a-reit.com"));
        assertFalse(UrlPolicy.trustedOrigin("https://a-reit.com."));
    }
    @Test public void authNeverOpensInEmbeddedBrowser() {
        assertEquals(UrlPolicy.Destination.BROWSER_AUTH, UrlPolicy.destination("https://accounts.google.com/o/oauth2/auth?state=opaque"));
        assertEquals(UrlPolicy.Destination.BROWSER_AUTH, UrlPolicy.destination("https://api.x.com/oauth/authorize?oauth_token=opaque"));
        assertEquals(UrlPolicy.Destination.BROWSER_AUTH, UrlPolicy.destination("https://a-reit.com/__native/browser-login"));
        assertEquals(UrlPolicy.Destination.BROWSER_AUTH, UrlPolicy.destination("https://a-reit.com/auth/passkey"));
    }
    @Test public void blocksUnsafeSchemesCredentialsAndInvalidUrls() {
        for (String url : new String[]{"http://a-reit.com", "javascript:alert(1)", "file:///sdcard/a", "content://private/file", "intent://x", "https://user@a-reit.com/", "https://a-reit.com:bad/", "https://x.test/?sessionToken=secret", "https://x.test/#access_token=secret", "https://x.test/?auth_token=secret", null}) {
            assertEquals(url, UrlPolicy.Destination.BLOCK, UrlPolicy.destination(url));
        }
    }
    @Test public void downloadDoesNotLeakSessionsToOtherHosts() {
        assertTrue(UrlPolicy.trustedDownload("https://a-reit.com/documents/terms.pdf"));
        assertTrue(UrlPolicy.trustedDownload("https://api.a-reit.com/public/document.pdf"));
        assertFalse(UrlPolicy.trustedDownload("https://api.a-reit.com/?access_token=secret"));
        assertFalse(UrlPolicy.trustedDownload("https://evil.test/file.pdf"));
        assertFalse(UrlPolicy.trustedDownload("blob:https://a-reit.com/random"));
    }
    @Test public void browserPageStripsCredentialsAndEveryQuery() {
        assertEquals("https://a-reit.com/markets", UrlPolicy.safeBrowserPage("https://a-reit.com/markets?token=secret#session"));
        assertEquals("https://a-reit.com/login", UrlPolicy.safeBrowserPage("https://a-reit.com/auth/callback/google?code=opaque"));
        assertEquals("https://a-reit.com/home", UrlPolicy.safeBrowserPage("https://evil.test/"));
    }
}
