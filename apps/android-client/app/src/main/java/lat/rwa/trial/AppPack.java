package lat.rwa.trial;

import android.content.Context;
import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The website's code, styles, fonts and common images kept on the phone (the website publishes the list as
 * /app-pack/manifest.json, see scripts/app-pack-manifest.mjs). The APK ships one build's files; afterwards the app
 * downloads, in the background, only what a newer build adds, verifies every file's SHA-256 and switches to the new
 * list at the next launch. Files are stored by hash, so a file never changes under a name already being served.
 * Requests not on the list, and the pages and API, always go to the network as before.
 */
final class AppPack {
    private static final String ORIGIN = UrlPolicy.ORIGIN;
    private static final Pattern PATH = Pattern.compile("^/(?:_next/static|icons|brand/a-reit|media/home|auth)/[A-Za-z0-9._~@+\\-/\\[\\]()]+$");
    private static final Pattern HASH = Pattern.compile("^[0-9a-f]{64}$");
    private static final long MAX_FILE = 8L * 1024 * 1024, MAX_UPDATE = 80L * 1024 * 1024;

    private final Context context;
    private final File store, active;
    private final Map<String, String> index = new HashMap<>();
    private final Set<String> bundled = new HashSet<>();
    private String build = "";

    AppPack(Context context) {
        this.context = context.getApplicationContext();
        store = new File(this.context.getFilesDir(), "app-pack");
        active = new File(store, "active.json");
        File files = new File(store, "files");
        if (!files.isDirectory()) files.mkdirs();
        try { JSONObject shipped = new JSONObject(read(this.context.getAssets().open("pack/manifest.json"))); collect(shipped, bundled, null); if (!active.isFile()) use(shipped); }
        catch (Exception ignored) { /* APK built without a pack: everything comes from the network. */ }
        try { if (active.isFile()) use(new JSONObject(read(new FileInputStream(active)))); }
        catch (Exception ignored) { /* A damaged list is ignored; the next update writes a fresh one. */ }
    }

    String build() { return build; }

    private void use(JSONObject manifest) throws Exception {
        Map<String, String> next = new HashMap<>();
        collect(manifest, null, next);
        index.clear();
        index.putAll(next);
        build = manifest.optString("build", "");
    }

    private static void collect(JSONObject manifest, Set<String> hashes, Map<String, String> paths) throws Exception {
        JSONArray files = manifest.getJSONArray("files");
        for (int i = 0; i < files.length(); i++) {
            JSONObject file = files.getJSONObject(i);
            String path = file.getString("p"), hash = file.getString("h");
            if (!PATH.matcher(path).matches() || path.contains("..") || !HASH.matcher(hash).matches() || file.getLong("s") > MAX_FILE) continue;
            if (hashes != null) hashes.add(hash);
            if (paths != null) paths.put(path, hash);
        }
    }

    /** A same-origin GET for a listed file, from the phone; null means "use the network". Runs off the UI thread. */
    WebResourceResponse lookup(String method, android.net.Uri url) {
        if (!"GET".equalsIgnoreCase(method) || url == null || !"https".equals(url.getScheme()) || !"a-reit.com".equalsIgnoreCase(url.getHost()) || url.getQuery() != null) return null;
        String path = url.getPath();
        String hash = path == null ? null : index.get(path);
        if (hash == null) return null;
        try {
            InputStream body;
            File local = new File(store, "files/" + hash);
            if (local.isFile()) body = new FileInputStream(local);
            else if (bundled.contains(hash)) body = context.getAssets().open("pack/files/" + hash, AssetManager.ACCESS_STREAMING);
            else return null;
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", path.startsWith("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache");
            headers.put("Access-Control-Allow-Origin", ORIGIN);
            String type = mime(path);
            return new WebResourceResponse(type, type.startsWith("text/") || type.endsWith("javascript") ? "utf-8" : null, 200, "OK", headers, body);
        } catch (IOException error) { return null; }
    }

    private static String mime(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".js")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".otf")) return "font/otf";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".avif")) return "image/avif";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    /**
     * Background update, called once per launch after the page is up: fetch the website's current list; if it is a
     * new build, download the files the phone lacks (verified by SHA-256), then make it the list for the next launch
     * and drop files neither list uses. Any failure leaves the current files untouched.
     */
    void update(String userAgent) {
        try {
            JSONObject latest = new JSONObject(new String(download(ORIGIN + "/app-pack/manifest.json", 2L * 1024 * 1024, userAgent), StandardCharsets.UTF_8));
            String latestBuild = latest.optString("build", "");
            if (latestBuild.isEmpty() || latestBuild.equals(build) && active.isFile()) return;
            Map<String, String> wanted = new HashMap<>();
            collect(latest, null, wanted);
            long fetched = 0;
            for (Map.Entry<String, String> file : wanted.entrySet()) {
                String hash = file.getValue();
                File target = new File(store, "files/" + hash);
                if (bundled.contains(hash) || target.isFile()) continue;
                byte[] body = download(ORIGIN + file.getKey(), MAX_FILE, userAgent);
                fetched += body.length;
                if (fetched > MAX_UPDATE) return;
                if (!hash.equals(sha256(body))) return;
                File temporary = new File(store, "files/" + hash + ".part");
                try (FileOutputStream out = new FileOutputStream(temporary)) { out.write(body); out.getFD().sync(); }
                if (!temporary.renameTo(target)) { temporary.delete(); return; }
            }
            File temporaryList = new File(store, "active.json.part");
            try (FileOutputStream out = new FileOutputStream(temporaryList)) { out.write(latest.toString().getBytes(StandardCharsets.UTF_8)); out.getFD().sync(); }
            Set<String> keep = new HashSet<>(wanted.values());
            keep.addAll(index.values());
            if (!temporaryList.renameTo(active)) { temporaryList.delete(); return; }
            File[] stored = new File(store, "files").listFiles();
            if (stored != null) for (File file : stored) if (!keep.contains(file.getName())) file.delete();
        } catch (Exception ignored) { /* Offline or a bad response: try again next launch. */ }
    }

    private static byte[] download(String address, long limit, String userAgent) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(20000);
        connection.setInstanceFollowRedirects(false);
        if (userAgent != null) connection.setRequestProperty("User-Agent", userAgent);
        try {
            if (connection.getResponseCode() != 200) throw new IOException("HTTP " + connection.getResponseCode());
            try (InputStream in = connection.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[16384];
                int read;
                long total = 0;
                while ((read = in.read(buffer)) != -1) {
                    total += read;
                    if (total > limit) throw new IOException("too large");
                    out.write(buffer, 0, read);
                }
                return out.toByteArray();
            }
        } finally { connection.disconnect(); }
    }

    private static String sha256(byte[] body) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(body);
        StringBuilder hex = new StringBuilder(64);
        for (byte b : digest) hex.append(String.format(Locale.ROOT, "%02x", b));
        return hex.toString();
    }

    private static String read(InputStream input) throws IOException {
        try (InputStream in = input) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[16384];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
}
