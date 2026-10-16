package lat.rwa.trial;

import java.net.URI;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class UrlPolicy {
    public enum Destination { INTERNAL, BROWSER_AUTH, WALLET, EXTERNAL, BLOCK }
    public static final String ORIGIN = "https://a-reit.com";
    static final String BROWSER_SIGN_IN_PATH = "/__native/browser-login";
    private static final Pattern SCHEME = Pattern.compile("^([A-Za-z][A-Za-z0-9+.-]{1,31}):");
    // Web, local-content and our own schemes are never handed to another app.
    private static final Set<String> NOT_APP_SCHEMES = new java.util.HashSet<>(java.util.Arrays.asList(
        "http", "https", "javascript", "file", "content", "data", "about", "blob", "filesystem", "ws", "wss", "ftp", "chrome", "android-app", "areit"));
    private static final Set<String> WALLET_HOSTS = new java.util.HashSet<>(java.util.Arrays.asList(
        "metamask.app.link", "link.metamask.io", "link.trustwallet.com", "go.cb-w.com", "rnbwapp.com", "link.safepal.io", "app.zerion.io"));
    private static final Set<String> AUTH_HOSTS = new java.util.HashSet<>(java.util.Arrays.asList("accounts.google.com", "x.com", "api.x.com", "twitter.com", "api.twitter.com"));
    private static final Pattern SESSION_PARAMETER = Pattern.compile("(?:^|[&;])(?:sessiontoken|session_token|access_token|auth_token|authorization|session)=", Pattern.CASE_INSENSITIVE);
    private UrlPolicy() {}
    private static URI secureUri(String url) {
        try {
            URI uri = new URI(url);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443) ? uri : null;
        } catch (Exception ignored) { return null; }
    }
    private static boolean containsSession(URI uri) {
        return SESSION_PARAMETER.matcher(uri.getQuery() == null ? "" : uri.getQuery()).find()
            || SESSION_PARAMETER.matcher(uri.getFragment() == null ? "" : uri.getFragment()).find();
    }
    public static Destination destination(String url) {
        if (walletLink(url)) return Destination.WALLET;
        URI uri = secureUri(url);
        if (uri == null) return Destination.BLOCK;
        if (trustedOrigin(url)) {
            if (BROWSER_SIGN_IN_PATH.equals(uri.getPath()) || "/auth/passkey".equals(uri.getPath())) return Destination.BROWSER_AUTH;
            return Destination.INTERNAL;
        }
        if (containsSession(uri)) return Destination.BLOCK;
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (AUTH_HOSTS.contains(host) || "github.com".equals(host) && uri.getPath() != null && uri.getPath().startsWith("/login")) return Destination.BROWSER_AUTH;
        return Destination.EXTERNAL;
    }
    /**
     * Wallet apps (WalletConnect): their own schemes (wc:, metamask:, okex:, tpoutside:, …), Android intent links,
     * and the https links a few wallets use instead. They open the wallet app; web and local schemes never match.
     */
    static boolean walletLink(String url) {
        if (url == null) return false;
        java.util.regex.Matcher scheme = SCHEME.matcher(url);
        if (scheme.find()) {
            String name = scheme.group(1).toLowerCase(Locale.ROOT);
            if (!NOT_APP_SCHEMES.contains(name)) return true;
        }
        URI uri = secureUri(url);
        if (uri == null || containsSession(uri)) return false;
        String host = uri.getHost().toLowerCase(Locale.ROOT), path = uri.getPath() == null ? "" : uri.getPath();
        return WALLET_HOSTS.contains(host) || ("www.okx.com".equals(host) || "okx.com".equals(host)) && (path.startsWith("/download") || path.startsWith("/ul/"));
    }
    /** The provider the user chose (Google / GitHub / X) when the app hands sign-in to the browser; null if unknown. */
    public static String signInProvider(String url) {
        URI uri = secureUri(url);
        if (uri == null) return null;
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (trustedOrigin(url)) {
            if (!BROWSER_SIGN_IN_PATH.equals(uri.getPath()) || uri.getRawQuery() == null) return null;
            for (String part : uri.getRawQuery().split("&")) {
                if (part.equals("provider=google") || part.equals("provider=github") || part.equals("provider=x")) return part.substring("provider=".length());
            }
            return null;
        }
        if ("accounts.google.com".equals(host)) return "google";
        if ("github.com".equals(host)) return "github";
        if (AUTH_HOSTS.contains(host)) return "x";
        return null;
    }
    public static boolean trustedOrigin(String url) {
        URI uri = secureUri(url);
        return uri != null && "a-reit.com".equalsIgnoreCase(uri.getHost());
    }
    public static boolean trustedDownload(String url) {
        URI uri = secureUri(url);
        return uri != null && !containsSession(uri) && (trustedOrigin(url) || "api.a-reit.com".equalsIgnoreCase(uri.getHost()));
    }
    public static String safeBrowserPage(String url) {
        URI uri = secureUri(url);
        if (uri == null || !trustedOrigin(url)) return "https://a-reit.com/home";
        String path = uri.getRawPath();
        if (path == null || path.isEmpty()) path = "/home";
        if (path.startsWith("/auth/") || path.startsWith("/__native/")) path = "/login";
        return "https://a-reit.com" + path;
    }
}
