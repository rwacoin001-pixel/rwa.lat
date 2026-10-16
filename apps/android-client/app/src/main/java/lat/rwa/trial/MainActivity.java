package lat.rwa.trial;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.provider.MediaStore;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import androidx.webkit.ScriptHandler;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** A-REIT Android client: the website edge to edge, with native launch, system bars, voice and files. Business state and authentication remain in the website. */
public final class MainActivity extends Activity {
    private static final String HOME = "https://a-reit.com/home";
    private static final int MEDIA_PERMISSION = 101, GEO_PERMISSION = 102, VOICE_PERMISSION = 103, CAMERA_PERMISSION = 104, FILE_PICK = 201, CAMERA_PICK = 202, STORAGE_PERMISSION = 105;
    private WebView webView;
    private FrameLayout pageContainer;
    private LinearLayout errorPanel;
    private boolean loading;
    // The launch splash stays until the page's own launch screen is ready (or 8s), so there is one launch screen.
    private boolean pageReady;
    private int pageColor;
    private int[] barInsets = new int[4];
    private boolean keyboardOpen;
    private String insetCss = "";
    private ScriptHandler insetScript;
    private ScriptHandler handoffScript;
    // The website's code and common images on the phone (AppPack); updated in the background once per launch.
    private AppPack pack;
    private boolean packUpdateStarted;
    private String handoffFallback;
    // Browser sign-in (lib/app-handoff.ts on the website): the PKCE verifier and state wait here while the user is in
    // the browser, in app-private storage so a process the system killed meanwhile can still finish the sign-in.
    private static final String HANDOFF_PREFS = "browser-sign-in";
    private static final long HANDOFF_MAX_AGE_MS = 10 * 60 * 1000;
    private String retryUrl = HOME;
    private PermissionRequest pendingMedia;
    private GeolocationPermissions.Callback pendingGeo;
    private String geoOrigin;
    private ValueCallback<Uri[]> pendingFiles;
    private Uri cameraUri;
    private File cameraFile;
    private SpeechRecognizer speechRecognizer;
    private String voiceLocale = "zh-CN";
    private boolean voiceActive;
    private boolean voiceBridge;
    private boolean mainFrameFailed;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Runnable voiceTimeout = () -> { stopVoice(true); emitVoice("error", null, "timeout", true); };
    private final Runnable pageTimeout = () -> { if (loading) showError("连接时间较长，请检查网络后重试。", retryUrl); };
    private final Runnable releaseLaunch = this::markPageReady;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Edge to edge: the page draws under transparent status and navigation bars and lays itself out with the
        // bar sizes we hand it (--native-inset-*), like the installed web app does with safe-area insets.
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) { window.setStatusBarContrastEnforced(false); window.setNavigationBarContrastEnforced(false); }
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30 ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }
        if (Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(false);
        else window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        pageColor = night ? Color.rgb(10, 11, 13) : Color.rgb(244, 241, 234);
        setBarIcons(!night);
        pageContainer = new FrameLayout(this);
        pageContainer.setBackgroundColor(pageColor);
        pageContainer.setOnApplyWindowInsetsListener(this::applyInsets);
        pack = new AppPack(this);
        webView = new WebView(this);
        webView.setBackgroundColor(pageColor);
        // No edge stretch (Android 12+ stretches the whole view, fixed tab bar included) and no browser scrollbars.
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        pageContainer.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(pageContainer);
        holdLaunchUntilReady();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " RwaLatAndroidTrial/1.1.3");
        settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(false);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(settings, WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_NONE);
        }
        installVoiceBridge();
        installAppBridge();
        installServiceWorkerPack();
        webView.setWebViewClient(new TrialWebClient());
        webView.setWebChromeClient(new TrialChromeClient());
        webView.setDownloadListener(this::download);
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::navigateBack);
        // Do not persist WebView history: callback URL state can contain one-use credentials.
        if (!handleBrowserSignIn(getIntent())) webView.loadUrl(HOME);
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleBrowserSignIn(intent);
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    /** Dark icons on a light page, light icons on a dark page; the bars themselves stay transparent. */
    private void setBarIcons(boolean lightPage) {
        if (Build.VERSION.SDK_INT >= 30) {
            // getDecorView() creates the decor if needed; Window.getInsetsController() returns null before that and the
            // call itself threw in onCreate (1.1.0 crashed on launch on every Android 11+ phone).
            WindowInsetsController controller = getWindow().getDecorView().getWindowInsetsController();
            if (controller == null) return;
            int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            controller.setSystemBarsAppearance(lightPage ? mask : 0, mask);
        } else {
            View decor = getWindow().getDecorView();
            int flags = decor.getSystemUiVisibility() & ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            decor.setSystemUiVisibility(lightPage ? flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : flags);
        }
    }
    /** System bars and cutout go to the page as CSS insets; only the keyboard still shrinks the page. */
    private WindowInsets applyInsets(View view, WindowInsets insets) {
        int top, right, bottom, left, keyboard;
        if (Build.VERSION.SDK_INT >= 30) {
            Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            keyboard = insets.getInsets(WindowInsets.Type.ime()).bottom;
            top = bars.top; right = bars.right; left = bars.left; bottom = keyboard > 0 ? 0 : bars.bottom;
        } else {
            top = insets.getStableInsetTop(); right = insets.getStableInsetRight(); left = insets.getStableInsetLeft();
            int stableBottom = insets.getStableInsetBottom(), windowBottom = insets.getSystemWindowInsetBottom();
            keyboard = windowBottom > stableBottom ? windowBottom : 0;
            bottom = keyboard > 0 ? 0 : stableBottom;
        }
        view.setPadding(0, 0, 0, keyboard);
        barInsets = new int[]{top, right, bottom, left};
        keyboardOpen = keyboard > 0;
        if (errorPanel != null) errorPanel.setPadding(dp(28), top + dp(28), dp(28), bottom + dp(28));
        pushInsets();
        return Build.VERSION.SDK_INT >= 30 ? WindowInsets.CONSUMED : insets.consumeSystemWindowInsets();
    }
    private void pushInsets() {
        if (webView == null) return;
        float density = getResources().getDisplayMetrics().density;
        String css = String.format(Locale.ROOT, "{top:'%.1fpx',right:'%.1fpx',bottom:'%.1fpx',left:'%.1fpx'}", barInsets[0] / density, barInsets[1] / density, barInsets[2] / density, barInsets[3] / density) + (keyboardOpen ? "|k" : "");
        // data-keyboard="open" lets the page keep its tab bar under the keyboard instead of riding up with it.
        String script = "(()=>{const v=" + css.replace("|k", "") + ",r=document.documentElement,s=r.style;for(const k in v)s.setProperty('--native-inset-'+k,v[k]);"
            + (keyboardOpen ? "r.dataset.keyboard='open';" : "delete r.dataset.keyboard;") + "})();";
        if (!css.equals(insetCss)) {
            insetCss = css;
            // Registered at document start so every new page lays out with the bars from its first frame.
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                if (insetScript != null) insetScript.remove();
                insetScript = WebViewCompat.addDocumentStartJavaScript(webView, script, java.util.Collections.singleton(UrlPolicy.ORIGIN));
            }
        }
        if (trustedCurrentPage()) webView.evaluateJavascript(script, null);
    }
    /** Keeps the launch splash (system splash on Android 12+, the icon window background before) until the page is ready. */
    private void holdLaunchUntilReady() {
        View content = findViewById(android.R.id.content);
        content.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
            @Override public boolean onPreDraw() {
                if (!pageReady) return false;
                content.getViewTreeObserver().removeOnPreDrawListener(this);
                return true;
            }
        });
        ui.postDelayed(releaseLaunch, 8000);
    }
    private void markPageReady() {
        if (pageReady) return;
        pageReady = true;
        ui.removeCallbacks(releaseLaunch);
        View content = findViewById(android.R.id.content);
        if (content != null) content.invalidate();
        startPackUpdate();
    }
    /** Once per launch, after the first page is up: bring the on-phone files to the website's current build. */
    private void startPackUpdate() {
        if (packUpdateStarted || webView == null) return;
        packUpdateStarted = true;
        String userAgent = webView.getSettings().getUserAgentString();
        ui.postDelayed(() -> { Thread worker = new Thread(() -> pack.update(userAgent), "app-pack"); worker.setPriority(Thread.MIN_PRIORITY); worker.start(); }, 3000);
    }
    /** The website's service worker fetches most files itself; serve those from the phone too. */
    private void installServiceWorkerPack() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE) || !WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) return;
        ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) { return pack.lookup(request.getMethod(), request.getUrl()); }
        });
    }
    /** Page to app messages: theme (system bar icons) and readiness (launch splash). Origin-bound, main frame only. */
    private void installAppBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) || !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;
        WebViewCompat.addWebMessageListener(webView, "RwaNativeAppChannel", java.util.Collections.singleton(UrlPolicy.ORIGIN), (view, message, sourceOrigin, isMainFrame, reply) -> {
            if (!isMainFrame || !UrlPolicy.trustedOrigin(sourceOrigin.toString()) || !trustedCurrentPage()) return;
            try {
                JSONObject payload = new JSONObject(message.getData());
                // A light tick on tab bar taps, like native tab bars (follows the system touch-feedback setting).
                if ("haptic".equals(payload.optString("type"))) { webView.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); return; }
                if ("share".equals(payload.optString("type")) || "save-image".equals(payload.optString("type"))) { handleNativeRequest(payload, reply); return; }
                if (!"chrome".equals(payload.optString("type"))) return;
                applyPageTheme("dark".equals(payload.optString("theme")));
                if (payload.optBoolean("ready")) markPageReady();
            } catch (Exception ignored) { /* Malformed page message: keep the current bars. */ }
        });
        WebViewCompat.addDocumentStartJavaScript(webView, APP_SCRIPT, java.util.Collections.singleton(UrlPolicy.ORIGIN));
    }
    // Watches <html> for the theme and the website's launch screen state (lib/launch-splash.ts) and reports changes.
    private static final String APP_SCRIPT = "(()=>{const ch=window.RwaNativeAppChannel;if(!ch)return;window.__rwaNativeCaps=['share','save-image'];const r=document.documentElement;let loaded=false,last='';"
        + "const send=()=>{const t=r.dataset.theme==='dark'?'dark':'light',st=r.dataset.launchState||'';"
        + "const ready=loaded&&(r.dataset.launch!=='app'||st==='leaving'||st==='gone');const m=t+'|'+ready;if(m===last)return;last=m;"
        + "ch.postMessage(JSON.stringify({type:'chrome',theme:t,ready}));};"
        + "new MutationObserver(send).observe(r,{attributes:true,attributeFilter:['data-theme','data-launch','data-launch-state']});"
        + "document.addEventListener('DOMContentLoaded',()=>{loaded=true;send();});send();"
        + "document.addEventListener('pointerdown',e=>{const t=e.target;if(e.isPrimary&&t instanceof Element&&t.closest('.liquid-dock button,.liquid-dock a'))ch.postMessage(JSON.stringify({type:'haptic'}));},{capture:true,passive:true});})();";
    private void applyPageTheme(boolean dark) {
        pageColor = dark ? Color.rgb(10, 11, 13) : Color.rgb(244, 241, 234);
        setBarIcons(!dark);
        pageContainer.setBackgroundColor(pageColor);
        if (webView != null) webView.setBackgroundColor(pageColor);
    }
    /** Without the message bridge (old WebView): read the theme once the page is up, and release the splash. */
    private void syncPageFallback() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;
        if (!trustedCurrentPage()) return;
        webView.evaluateJavascript("document.documentElement.dataset.theme||''", value -> applyPageTheme("\"dark\"".equals(value)));
        markPageReady();
    }
    private String appVersion() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (PackageManager.NameNotFoundException error) { return ""; }
    }
    private boolean trustedCurrentPage() { return webView != null && UrlPolicy.trustedOrigin(webView.getUrl()); }
    private boolean granted(String permission) { return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    private void navigateBack() {
        stopVoice(true);
        if (errorPanel != null) { hideError(); webView.loadUrl(HOME); }
        else if (webView.canGoBack()) webView.goBack();
        else new AlertDialog.Builder(this).setMessage("退出 A-REIT？").setNeutralButton("客户端选项", (dialog, which) -> showMenu()).setNegativeButton("继续使用", null).setPositiveButton("退出", (dialog, which) -> finish()).show();
    }
    @Override public void onBackPressed() { navigateBack(); }
    private void showMenu() {
        new AlertDialog.Builder(this).setTitle("A-REIT")
            .setItems(new String[]{"重新加载", "用浏览器打开当前页面", "浏览器登录", "清除应用内登录与缓存", "设备信息", "开源许可"}, (dialog, item) -> {
                if (item == 0) { hideError(); webView.reload(); }
                if (item == 1) openBrowser(UrlPolicy.safeBrowserPage(webView.getUrl()));
                if (item == 2) showBrowserAuth();
                if (item == 3) new AlertDialog.Builder(this).setMessage("清除应用内会话、网站存储和缓存？浏览器登录不受影响。")
                    .setNegativeButton("取消", null).setPositiveButton("清除", (confirm, which) -> {
                        stopVoice(true); webView.stopLoading(); android.webkit.WebStorage.getInstance().deleteAllData();
                        CookieManager.getInstance().removeAllCookies(done -> { CookieManager.getInstance().flush(); webView.clearCache(true); webView.clearHistory(); hideError(); webView.loadUrl(HOME); });
                    }).show();
                if (item == 4) {
                    PackageManager manager = getPackageManager();
                    android.content.pm.PackageInfo provider = WebViewCompat.getCurrentWebViewPackage(this);
                    String version = provider == null ? "不可用" : provider.packageName + " " + provider.versionName;
                    new AlertDialog.Builder(this).setTitle("设备信息").setMessage("客户端 " + appVersion() + "\nAndroid " + Build.VERSION.RELEASE + " · API " + Build.VERSION.SDK_INT + "\nWebView " + version + "\n系统语音识别：" + (SpeechRecognizer.isRecognitionAvailable(this) ? "可调用，尚需真机验证" : "未提供") + "\n\nGoogle / X / 通行密钥：浏览器路径。浏览器会话不会自动同步到应用。").setPositiveButton("知道了", null).show();
                }
                if (item == 5) {
                    try (java.io.InputStream notice = getAssets().open("licenses/NOTICE.txt"); java.io.InputStream license = getAssets().open("licenses/Apache-2.0.txt")) {
                        TextView text = new TextView(this); text.setPadding(dp(20), dp(12), dp(20), dp(12));
                        text.setText(new String(readAsset(notice), java.nio.charset.StandardCharsets.UTF_8) + "\n\n" + new String(readAsset(license), java.nio.charset.StandardCharsets.UTF_8));
                        android.widget.ScrollView scroll = new android.widget.ScrollView(this); scroll.addView(text);
                        new AlertDialog.Builder(this).setTitle("开源许可").setView(scroll).setPositiveButton("关闭", null).show();
                    } catch (java.io.IOException error) { toast("许可文件无法打开。"); }
                }
            }).show();
    }
    private byte[] readAsset(java.io.InputStream input) throws java.io.IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int length;
        while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
        return output.toByteArray();
    }
    private void showBrowserAuth() {
        new AlertDialog.Builder(this).setTitle("在浏览器中登录")
            .setMessage("Google、X 和通行密钥会在系统浏览器中完成登录，完成后自动回到 App 并保持登录。")
            .setNegativeButton("取消", null).setPositiveButton("继续", (dialog, which) -> startBrowserSignIn(null)).show();
    }
    private static String randomToken(int bytes) {
        byte[] value = new byte[bytes];
        new java.security.SecureRandom().nextBytes(value);
        return Base64.encodeToString(value, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }
    /** provider: the button the user tapped (google / github / x); the browser then opens that provider directly. */
    private void startBrowserSignIn(String provider) {
        try {
            String verifier = randomToken(32);
            String state = randomToken(16);
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            String challenge = Base64.encodeToString(digest, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
            getSharedPreferences(HANDOFF_PREFS, MODE_PRIVATE).edit().putString("verifier", verifier).putString("state", state).putLong("at", System.currentTimeMillis()).commit();
            openBrowser(UrlPolicy.ORIGIN + "/app-login?challenge=" + challenge + "&state=" + state + (provider == null ? "" : "&provider=" + provider));
        } catch (java.security.NoSuchAlgorithmException error) { toast("此设备暂不支持浏览器登录。"); }
    }
    /** areit://auth?code=…&state=… from the browser: matching state only, then the page redeems code + verifier. */
    private boolean handleBrowserSignIn(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"areit".equals(data.getScheme()) || !"auth".equals(data.getHost())) return false;
        SharedPreferences pending = getSharedPreferences(HANDOFF_PREFS, MODE_PRIVATE);
        String state = pending.getString("state", null), verifier = pending.getString("verifier", null);
        long at = pending.getLong("at", 0);
        String code = data.getQueryParameter("code"), returnedState = data.getQueryParameter("state");
        boolean valid = state != null && verifier != null && System.currentTimeMillis() - at < HANDOFF_MAX_AGE_MS
            && state.equals(returnedState) && code != null && code.matches("[A-Za-z0-9_-]{43,128}");
        pending.edit().clear().commit();
        intent.setData(null);
        if (!valid) { toast("登录链接已失效，请重新登录。"); if (webView.getUrl() == null) webView.loadUrl(HOME); return true; }
        try {
            String script = "window.__rwaAppHandoff=" + new JSONObject().put("code", code).put("verifier", verifier) + ";";
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                if (handoffScript != null) handoffScript.remove();
                handoffScript = WebViewCompat.addDocumentStartJavaScript(webView, script, java.util.Collections.singleton(UrlPolicy.ORIGIN));
            } else handoffFallback = script;
        } catch (org.json.JSONException error) { return true; }
        hideError();
        webView.loadUrl(UrlPolicy.ORIGIN + "/app-handoff");
        return true;
    }
    /** The secrets are injected only into the hand-off page, once. */
    private void finishHandoffInjection(String url) {
        boolean handoffPage = url != null && "/app-handoff".equals(Uri.parse(url).getPath()) && UrlPolicy.trustedOrigin(url);
        if (handoffPage && handoffFallback != null) { webView.evaluateJavascript(handoffFallback, null); handoffFallback = null; }
        if (handoffScript != null && (handoffPage || url == null)) { handoffScript.remove(); handoffScript = null; }
    }
    /**
     * WalletConnect hands the request to the wallet app through its link. Like a browser: only apps that accept
     * BROWSABLE links, never a named component, and no URI permission grants. The wallet returns via areit://wallet.
     */
    private void openWallet(String url) {
        Intent intent;
        try {
            intent = url.regionMatches(true, 0, "intent:", 0, 7) ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        } catch (java.net.URISyntaxException error) { toast("无法打开这个钱包链接。"); return; }
        String fallback = intent.getStringExtra("browser_fallback_url");
        String walletPackage = intent.getPackage();
        intent.setComponent(null);
        intent.setSelector(null);
        intent.setFlags(intent.getFlags() & ~(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try { startActivity(intent); return; } catch (ActivityNotFoundException | SecurityException ignored) { /* not installed */ }
        if (fallback != null && UrlPolicy.destination(fallback) != UrlPolicy.Destination.BLOCK && fallback.startsWith("https://")) { openBrowser(fallback); return; }
        if (walletPackage != null && walletPackage.matches("[A-Za-z0-9_.]{3,100}")) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + walletPackage)).addCategory(Intent.CATEGORY_BROWSABLE)); return; }
            catch (ActivityNotFoundException ignored) { /* no store either */ }
        }
        toast("没有找到这个钱包 App，请先安装。");
    }
    private void openBrowser(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException error) { toast("未找到可用浏览器，请先安装浏览器。"); }
    }
    private boolean handleNavigation(String url, boolean mainFrame, boolean userGesture) {
        UrlPolicy.Destination destination = UrlPolicy.destination(url);
        if (destination == UrlPolicy.Destination.INTERNAL) return false;
        if (!mainFrame) return true;
        if (destination == UrlPolicy.Destination.BROWSER_AUTH) {
            // The user already tapped Google / GitHub / X: go straight to the browser; otherwise explain first.
            String provider = UrlPolicy.signInProvider(url);
            if (provider != null && trustedCurrentPage()) startBrowserSignIn(provider); else showBrowserAuth();
            return true;
        }
        if (destination == UrlPolicy.Destination.WALLET) {
            if (trustedCurrentPage()) openWallet(url); else toast("此链接未获准在客户端打开。");
            return true;
        }
        if (destination == UrlPolicy.Destination.EXTERNAL && userGesture && trustedCurrentPage()) {
            new AlertDialog.Builder(this).setMessage("使用浏览器打开外部链接？").setNegativeButton("取消", null).setPositiveButton("打开", (dialog, which) -> openBrowser(url)).show();
        } else toast("此链接未获准在客户端打开。");
        return true;
    }
    private void showError(String message, String url) {
        retryUrl = UrlPolicy.destination(url) == UrlPolicy.Destination.INTERNAL ? url : HOME;
        loading = false; ui.removeCallbacks(pageTimeout); webView.setVisibility(View.INVISIBLE); markPageReady(); setBarIcons(false);
        if (errorPanel != null) pageContainer.removeView(errorPanel);
        errorPanel = new LinearLayout(this); errorPanel.setOrientation(LinearLayout.VERTICAL); errorPanel.setGravity(Gravity.CENTER); errorPanel.setBackgroundColor(Color.rgb(23, 26, 32));
        errorPanel.setPadding(dp(28), barInsets[0] + dp(28), dp(28), barInsets[2] + dp(28));
        TextView heading = new TextView(this); heading.setText("暂时无法连接"); heading.setTextColor(Color.WHITE); heading.setTextSize(22); errorPanel.addView(heading);
        TextView detail = new TextView(this); detail.setText(message); detail.setTextColor(Color.LTGRAY); detail.setGravity(Gravity.CENTER); detail.setPadding(0, dp(16), 0, dp(16)); errorPanel.addView(detail);
        Button retry = new Button(this); retry.setText("重试"); retry.setOnClickListener(view -> { String target = retryUrl; hideError(); webView.loadUrl(target); }); errorPanel.addView(retry);
        Button browser = new Button(this); browser.setText("用浏览器打开"); browser.setOnClickListener(view -> openBrowser(UrlPolicy.safeBrowserPage(retryUrl))); errorPanel.addView(browser);
        pageContainer.addView(errorPanel, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }
    private void hideError() { if (errorPanel != null) { pageContainer.removeView(errorPanel); errorPanel = null; } webView.setVisibility(View.VISIBLE); }
    private final class TrialWebClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return handleNavigation(request.getUrl().toString(), request.isForMainFrame(), request.hasGesture()); }
        @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            if (UrlPolicy.destination(url) != UrlPolicy.Destination.INTERNAL) { view.stopLoading(); handleNavigation(url, true, false); return; }
            hideError(); mainFrameFailed = false; retryUrl = url; loading = true;
            ui.removeCallbacks(pageTimeout); ui.postDelayed(pageTimeout, 30000); stopVoice(true); denyPendingPermissions();
        }
        @Override public void onPageFinished(WebView view, String url) {
            loading = false; ui.removeCallbacks(pageTimeout); syncPageFallback();
            if (!mainFrameFailed && errorPanel == null && UrlPolicy.trustedOrigin(url)) installVoiceScript();
        }
        @Override public void onPageCommitVisible(WebView view, String url) { pushInsets(); finishHandoffInjection(url); }
        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) { mainFrameFailed = true; showError("请检查网络连接，再重新加载。", request.getUrl().toString()); }
        }
        @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 400) { mainFrameFailed = true; showError("服务器暂时不可用（" + response.getStatusCode() + "）。请稍后重试。", request.getUrl().toString()); }
        }
        @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) { handler.cancel(); mainFrameFailed = true; showError("安全连接验证失败。请检查设备时间或网络后重试。", HOME); }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String scheme = request.getUrl().getScheme();
            if (request.isForMainFrame() && UrlPolicy.destination(request.getUrl().toString()) != UrlPolicy.Destination.INTERNAL) return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            if ("http".equalsIgnoreCase(scheme) || "file".equalsIgnoreCase(scheme) || "content".equalsIgnoreCase(scheme)) return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            return pack.lookup(request.getMethod(), request.getUrl());
        }
        @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            view.destroy(); new AlertDialog.Builder(MainActivity.this).setTitle("页面需要重新打开").setMessage("系统已停止网页进程，请重新启动客户端。").setCancelable(false).setPositiveButton("重新打开", (dialog, which) -> recreate()).show(); return true;
        }
    }
    private final class TrialChromeClient extends WebChromeClient {
        @Override public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                if (!trustedCurrentPage() || !UrlPolicy.trustedOrigin(request.getOrigin().toString())) { request.deny(); return; }
                if (pendingMedia != null) pendingMedia.deny(); pendingMedia = request;
                List<String> needed = new ArrayList<>();
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && !granted(Manifest.permission.CAMERA)) needed.add(Manifest.permission.CAMERA);
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && !granted(Manifest.permission.RECORD_AUDIO)) needed.add(Manifest.permission.RECORD_AUDIO);
                }
                if (needed.isEmpty()) grantMedia(); else requestPermissions(needed.toArray(new String[0]), MEDIA_PERMISSION);
            });
        }
        @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (pendingMedia == request) pendingMedia = null; }
        @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            if (!trustedCurrentPage() || !UrlPolicy.trustedOrigin(origin)) { callback.invoke(origin, false, false); return; }
            if (pendingGeo != null) pendingGeo.invoke(geoOrigin, false, false);
            pendingGeo = callback; geoOrigin = origin;
            if (granted(Manifest.permission.ACCESS_COARSE_LOCATION)) grantGeo(); else requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}, GEO_PERMISSION);
        }
        @Override public void onGeolocationPermissionsHidePrompt() { pendingGeo = null; geoOrigin = null; }
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (!trustedCurrentPage()) { callback.onReceiveValue(null); return true; }
            cancelFiles(); pendingFiles = callback;
            String[] accepted = params.getAcceptTypes();
            boolean imageOnly = accepted.length > 0;
            for (String type : accepted) if (!type.startsWith("image/")) imageOnly = false;
            if (imageOnly && params.isCaptureEnabled()) startCamera();
            else if (imageOnly) new AlertDialog.Builder(MainActivity.this).setTitle("选择照片").setItems(new String[]{"拍照", "从文件选择"}, (dialog, index) -> { if (index == 0) startCamera(); else chooseFiles(params); }).setOnCancelListener(dialog -> cancelFiles()).show();
            else chooseFiles(params);
            return true;
        }
    }
    private void grantMedia() {
        if (pendingMedia == null) return;
        PermissionRequest request = pendingMedia; pendingMedia = null;
        if (!trustedCurrentPage() || !UrlPolicy.trustedOrigin(request.getOrigin().toString())) { request.deny(); return; }
        List<String> allowed = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && granted(Manifest.permission.CAMERA)) allowed.add(resource);
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && granted(Manifest.permission.RECORD_AUDIO)) allowed.add(resource);
        }
        if (allowed.isEmpty()) { request.deny(); toast("权限未开启，可在系统设置中允许相机或麦克风。"); } else request.grant(allowed.toArray(new String[0]));
    }
    private void grantGeo() {
        if (pendingGeo != null) { pendingGeo.invoke(geoOrigin, trustedCurrentPage() && UrlPolicy.trustedOrigin(geoOrigin) && granted(Manifest.permission.ACCESS_COARSE_LOCATION), false); pendingGeo = null; geoOrigin = null; }
    }
    private void denyPendingPermissions() {
        if (pendingMedia != null) { pendingMedia.deny(); pendingMedia = null; }
        if (pendingGeo != null) { pendingGeo.invoke(geoOrigin, false, false); pendingGeo = null; geoOrigin = null; }
    }
    private void chooseFiles(WebChromeClient.FileChooserParams params) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
        String[] types = java.util.Arrays.stream(params.getAcceptTypes()).filter(type -> type.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+*_-]+") && !"*/*".equals(type)).toArray(String[]::new);
        if (types.length == 1) intent.setType(types[0]); else if (types.length > 1) intent.putExtra(Intent.EXTRA_MIME_TYPES, types);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivityForResult(intent, FILE_PICK); } catch (ActivityNotFoundException error) { cancelFiles(); toast("未找到文件选择器。"); }
    }
    private void startCamera() {
        if (!granted(Manifest.permission.CAMERA)) { requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION); return; }
        try {
            File directory = new File(getCacheDir(), "captures"); if (!directory.exists() && !directory.mkdirs()) throw new java.io.IOException("capture directory");
            cameraFile = File.createTempFile("capture-", ".jpg", directory);
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", cameraFile);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, cameraUri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            intent.setClipData(android.content.ClipData.newRawUri("capture", cameraUri));
            startActivityForResult(intent, CAMERA_PICK);
        } catch (Exception error) { cancelFiles(); toast("无法打开相机，请改用文件选择。"); }
    }
    private void cancelFiles() { if (pendingFiles != null) { pendingFiles.onReceiveValue(null); pendingFiles = null; } }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_PICK && requestCode != CAMERA_PICK) return;
        if (pendingFiles == null) return;
        Uri[] result = null;
        if (trustedCurrentPage() && resultCode == RESULT_OK) {
            if (requestCode == CAMERA_PICK && cameraUri != null && cameraFile != null && cameraFile.length() > 0) result = new Uri[]{cameraUri};
            else if (requestCode == FILE_PICK) {
                Uri[] raw = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                if (raw != null) result = java.util.Arrays.stream(raw).filter(uri -> "content".equals(uri.getScheme())).toArray(Uri[]::new);
            }
        }
        pendingFiles.onReceiveValue(result); pendingFiles = null; cameraUri = null;
        if (cameraFile != null) { File captured = cameraFile; ui.postDelayed(() -> captured.delete(), 300000); cameraFile = null; }
    }
    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MEDIA_PERMISSION) grantMedia();
        if (requestCode == GEO_PERMISSION) grantGeo();
        if (requestCode == VOICE_PERMISSION) { if (granted(Manifest.permission.RECORD_AUDIO)) startVoice(voiceLocale); else emitVoice("error", null, "permission-denied", true); }
        if (requestCode == STORAGE_PERMISSION) finishPendingSave(granted(Manifest.permission.WRITE_EXTERNAL_STORAGE));
        if (requestCode == CAMERA_PERMISSION) { if (granted(Manifest.permission.CAMERA)) startCamera(); else { cancelFiles(); toast("相机权限未开启，可选择已有文件。"); } }
    }
    // ---- Share sheet and gallery (lib/native-app.ts): the WebView has neither Web Share nor blob downloads. ----
    private static final int NATIVE_IMAGE_LIMIT = 12 * 1024 * 1024;
    private Runnable pendingSave;
    private androidx.webkit.JavaScriptReplyProxy pendingSaveReply;
    private String pendingSaveId;
    private void answer(androidx.webkit.JavaScriptReplyProxy reply, String id, boolean ok, String reason) {
        ui.post(() -> {
            try { reply.postMessage(new JSONObject().put("id", id).put("ok", ok).put("reason", reason == null ? "" : reason).toString()); }
            catch (Exception ignored) { /* The page went away. */ }
        });
    }
    private static String imageMime(byte[] data) {
        if (data.length > 8 && (data[0] & 0xff) == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G') return "image/png";
        if (data.length > 3 && (data[0] & 0xff) == 0xff && (data[1] & 0xff) == 0xd8 && (data[2] & 0xff) == 0xff) return "image/jpeg";
        return null;
    }
    private static String imageName(String requested, String mime) {
        String base = requested == null ? "" : requested.replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("\\.(png|jpe?g)$", "");
        if (base.isEmpty() || base.length() > 80) base = "a-reit-" + System.currentTimeMillis();
        return base + ("image/png".equals(mime) ? ".png" : ".jpg");
    }
    private void handleNativeRequest(JSONObject payload, androidx.webkit.JavaScriptReplyProxy reply) {
        String id = payload.optString("id");
        if (!id.matches("[A-Za-z0-9]{1,40}")) return;
        String type = payload.optString("type"), encoded = payload.optString("image", "");
        String text = payload.optString("text", ""), title = payload.optString("title", "");
        if (text.length() > 2000) text = text.substring(0, 2000);
        final String shareText = text, shareTitle = title.length() > 120 ? title.substring(0, 120) : title;
        if ("share".equals(type) && encoded.isEmpty()) {
            if (shareText.isEmpty()) { answer(reply, id, false, "failed"); return; }
            Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, shareText);
            if (!shareTitle.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, shareTitle);
            try { startActivity(Intent.createChooser(send, null)); answer(reply, id, true, null); }
            catch (ActivityNotFoundException error) { answer(reply, id, false, "failed"); }
            return;
        }
        if (encoded.length() > NATIVE_IMAGE_LIMIT / 3 * 4 + 8) { answer(reply, id, false, "failed"); return; }
        Thread worker = new Thread(() -> {
            byte[] data;
            try { data = Base64.decode(encoded, Base64.DEFAULT); } catch (IllegalArgumentException error) { answer(reply, id, false, "failed"); return; }
            String mime = imageMime(data);
            if (mime == null || data.length > NATIVE_IMAGE_LIMIT) { answer(reply, id, false, "failed"); return; }
            String name = imageName(payload.optString("name"), mime);
            if ("save-image".equals(type)) {
                Runnable save = () -> answer(reply, id, saveToGallery(data, name, mime), "failed");
                if (Build.VERSION.SDK_INT >= 29 || granted(Manifest.permission.WRITE_EXTERNAL_STORAGE)) save.run();
                else ui.post(() -> {
                    if (pendingSaveReply != null) answer(pendingSaveReply, pendingSaveId, false, "failed");
                    pendingSave = save; pendingSaveReply = reply; pendingSaveId = id;
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_PERMISSION);
                });
                return;
            }
            try {
                File folder = new File(getCacheDir(), "shared");
                File[] old = folder.listFiles();
                if (old != null) for (File file : old) if (System.currentTimeMillis() - file.lastModified() > 60 * 60 * 1000) file.delete();
                if (!folder.isDirectory() && !folder.mkdirs()) throw new java.io.IOException("no folder");
                File image = new File(folder, name);
                try (java.io.FileOutputStream out = new java.io.FileOutputStream(image)) { out.write(data); }
                Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", image);
                ui.post(() -> {
                    Intent send = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    send.setClipData(android.content.ClipData.newRawUri(name, uri));
                    if (!shareText.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, shareText);
                    if (!shareTitle.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, shareTitle);
                    try { startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)); answer(reply, id, true, null); }
                    catch (ActivityNotFoundException error) { answer(reply, id, false, "failed"); }
                });
            } catch (Exception error) { answer(reply, id, false, "failed"); }
        }, "native-share");
        worker.start();
    }
    /** Pictures/A-REIT in the gallery. Android 10+ needs no permission; 8-9 ask for storage once. */
    private boolean saveToGallery(byte[] data, String name, String mime) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                android.content.ContentResolver resolver = getContentResolver();
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                values.put(MediaStore.Images.Media.MIME_TYPE, mime);
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/A-REIT");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return false;
                try (java.io.OutputStream out = resolver.openOutputStream(uri)) { if (out == null) throw new java.io.IOException("no stream"); out.write(data); }
                catch (java.io.IOException error) { resolver.delete(uri, null, null); return false; }
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                return true;
            }
            File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "A-REIT");
            if (!folder.isDirectory() && !folder.mkdirs()) return false;
            File image = new File(folder, name);
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(image)) { out.write(data); }
            android.media.MediaScannerConnection.scanFile(this, new String[]{image.getAbsolutePath()}, new String[]{mime}, null);
            return true;
        } catch (Exception error) { return false; }
    }
    private void finishPendingSave(boolean allowed) {
        Runnable save = pendingSave;
        androidx.webkit.JavaScriptReplyProxy reply = pendingSaveReply;
        String id = pendingSaveId;
        pendingSave = null; pendingSaveReply = null; pendingSaveId = null;
        if (save == null) return;
        if (allowed) { Thread worker = new Thread(save, "native-save"); worker.start(); }
        else { answer(reply, id, false, "failed"); toast("未开启存储权限，无法保存到相册。"); }
    }
    private void download(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
        if (!trustedCurrentPage() || !UrlPolicy.trustedDownload(url)) { toast("此文件请在浏览器中下载。受保护或生成的文件不会自动传递应用会话。"); return; }
        String filename = URLUtil.guessFileName(url, contentDisposition, mimetype).replaceAll("[^\\p{L}\\p{N}._-]", "_");
        new AlertDialog.Builder(this).setMessage("下载文件到应用目录？\n" + filename).setNegativeButton("取消", null).setPositiveButton("下载", (dialog, which) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setTitle(filename); if (mimetype != null) request.setMimeType(mimetype);
                request.setAllowedOverMetered(true); request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
                request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, filename);
                ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
                toast("下载已交给系统。文件保存于应用目录，卸载应用时移除。");
            } catch (Exception error) { toast("无法下载，请用浏览器打开此页面。"); }
        }).show();
    }
    private void installVoiceBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) || !SpeechRecognizer.isRecognitionAvailable(this)) return;
        voiceBridge = true;
        WebViewCompat.addWebMessageListener(webView, "RwaNativeVoiceChannel", java.util.Collections.singleton("https://a-reit.com"), (view, message, sourceOrigin, isMainFrame, reply) -> {
            if (!isMainFrame || !UrlPolicy.trustedOrigin(sourceOrigin.toString()) || !trustedCurrentPage()) return;
            try {
                JSONObject payload = new JSONObject(message.getData());
                if ("start".equals(payload.optString("type"))) startVoice(payload.optString("locale", "zh-CN"));
                else if ("stop".equals(payload.optString("type"))) stopVoice(false);
            } catch (Exception error) { emitVoice("error", null, "invalid-request", true); }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) WebViewCompat.addDocumentStartJavaScript(webView, voiceScript(), java.util.Collections.singleton("https://a-reit.com"));
    }
    private String voiceScript() {
        return "(()=>{if(!window.RwaNativeVoiceChannel)return;window.RwaNativeVoice=Object.freeze({start:({locale}={})=>window.RwaNativeVoiceChannel.postMessage(JSON.stringify({type:'start',locale:locale||'zh-CN'})),stop:()=>window.RwaNativeVoiceChannel.postMessage(JSON.stringify({type:'stop'}))});})()";
    }
    private void installVoiceScript() { if (voiceBridge && trustedCurrentPage()) webView.evaluateJavascript(voiceScript(), null); }
    private void startVoice(String locale) {
        if (!trustedCurrentPage() || !voiceBridge) return;
        voiceLocale = locale.matches("[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,2}") ? locale : "zh-CN";
        if (!granted(Manifest.permission.RECORD_AUDIO)) { requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, VOICE_PERMISSION); return; }
        stopVoice(true);
        try { speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this); }
        catch (Exception error) { emitVoice("error", null, "recognizer-unavailable", true); return; }
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) { emitVoice("listening", null, null, false); }
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onError(int error) { emitVoice("error", null, "recognizer-" + error, true); stopVoice(true); }
            @Override public void onResults(Bundle results) { transcript(results, true); stopVoice(true); }
            @Override public void onPartialResults(Bundle results) { transcript(results, false); }
            @Override public void onEvent(int type, Bundle params) {}
        });
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE, voiceLocale).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try { voiceActive = true; speechRecognizer.startListening(intent); ui.postDelayed(voiceTimeout, 30000); }
        catch (Exception error) { emitVoice("error", null, "recognizer-unavailable", true); stopVoice(true); }
    }
    private void transcript(Bundle result, boolean complete) {
        ArrayList<String> values = result.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (values != null && !values.isEmpty()) emitVoice("result", values.get(0), null, complete);
    }
    private void stopVoice(boolean cancel) {
        ui.removeCallbacks(voiceTimeout);
        if (speechRecognizer == null) return;
        if (!cancel) { speechRecognizer.stopListening(); ui.postDelayed(voiceTimeout, 10000); return; }
        speechRecognizer.cancel(); speechRecognizer.destroy(); speechRecognizer = null;
        if (voiceActive) { voiceActive = false; emitVoice("end", null, null, true); }
    }
    private void emitVoice(String type, String text, String error, boolean complete) {
        if (!trustedCurrentPage()) return;
        try {
            JSONObject detail = new JSONObject().put("type", type).put("final", complete);
            if (text != null) detail.put("text", text); if (error != null) detail.put("error", error);
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('rwa-native-voice',{detail:" + detail + "}));", null);
        } catch (Exception ignored) { /* Never log speech text or page/session data. */ }
    }
    @Override protected void onPause() { stopVoice(true); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onDestroy() {
        stopVoice(true); denyPendingPermissions(); cancelFiles(); ui.removeCallbacksAndMessages(null);
        if (webView != null) { pageContainer.removeView(webView); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
