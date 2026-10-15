package lat.rwa.trial;

import java.net.URI;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class UrlPolicy {
    public enum Destination { INTERNAL, BROWSER_AUTH, EXTERNAL, BLOCK }
    public static final String ORIGIN = "https://a-reit.com";
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
        URI uri = secureUri(url);
        if (uri == null) return Destination.BLOCK;
        if (trustedOrigin(url)) {
            if ("/__native/browser-login".equals(uri.getPath()) || "/auth/passkey".equals(uri.getPath())) return Destination.BROWSER_AUTH;
            return Destination.INTERNAL;
        }
        if (containsSession(uri)) return Destination.BLOCK;
        if (AUTH_HOSTS.contains(uri.getHost().toLowerCase(Locale.ROOT))) return Destination.BROWSER_AUTH;
        return Destination.EXTERNAL;
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
